#!/usr/bin/env python3
"""
Telethon Proxy Mainframe Worker
================================
Continuously probes and validates proxies from public.proxies table.
- Parses multiple proxy formats from telegram scrape
- Tests connectivity via Telethon MTProto handshake
- Updates DB health status (is_active, last_tested_at)
"""

import asyncio
import os
import re
import logging
from typing import Optional, Tuple, Dict, Any
from datetime import datetime
from urllib.parse import urlparse

import httpx
from telethon import TelegramClient
from telethon.errors import (
    ConnectionError as TelethonConnectionError,
    AuthKeyError,
    RPCError,
)
from telethon.network.connection import Connection
import supabase
from supabase import create_client

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("proxy-worker")


# ============================================================================
# ENVIRONMENT & CONFIGURATION
# ============================================================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TELEGRAM_API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH", "")

# Probe timeout (seconds)
PROBE_TIMEOUT = 15

# Worker loop delay between proxy cycles (seconds)
WORKER_CYCLE_DELAY = 2

# Max concurrent probes (Telethon session limit ~3-5 per machine)
MAX_CONCURRENT_PROBES = 2

if not all([SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_API_ID, TELEGRAM_API_HASH]):
    raise ValueError(
        "Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "
        "TELEGRAM_API_ID, TELEGRAM_API_HASH"
    )

# Initialize Supabase client (service-role bypasses RLS)
db = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# ============================================================================
# PROXY PARSER
# ============================================================================

def parse_proxy_string(raw_text: str) -> Optional[Dict[str, Any]]:
    """
    Parse proxy line in one of the supported formats:
    - socks5://ip:port:user:pass
    - socks5://user:pass@ip:port
    - ip:port:user:pass
    - ip:port

    Returns dict with {ip, port, username, password} or None on parse error.
    """
    raw_text = raw_text.strip()
    if not raw_text:
        return None

    try:
        # Remove protocol prefix if present
        if raw_text.startswith("socks5://"):
            raw_text = raw_text[9:]
        elif raw_text.startswith("http://") or raw_text.startswith("https://"):
            return None  # Only SOCKS5 supported for Telethon MTProto

        # Format: user:pass@ip:port
        if "@" in raw_text:
            auth, host = raw_text.rsplit("@", 1)
            username, password = auth.split(":", 1)
            ip, port = host.rsplit(":", 1)
            return {
                "ip": ip.strip(),
                "port": int(port),
                "username": username.strip() or None,
                "password": password.strip() or None,
            }

        # Format: ip:port:user:pass (4 segments)
        parts = raw_text.split(":")
        if len(parts) == 4:
            return {
                "ip": parts[0].strip(),
                "port": int(parts[1]),
                "username": parts[2].strip() or None,
                "password": parts[3].strip() or None,
            }

        # Format: ip:port (2 segments)
        if len(parts) == 2:
            return {
                "ip": parts[0].strip(),
                "port": int(parts[1]),
                "username": None,
                "password": None,
            }

        return None

    except (ValueError, IndexError):
        return None


# ============================================================================
# SUPABASE OPERATIONS
# ============================================================================

def ingest_proxies(proxy_lines: list[str]) -> int:
    """
    Batch insert proxies into public.proxies table.
    - Parses each line
    - Skips invalid formats
    - Uses ON CONFLICT (raw_text) DO NOTHING to dedupe

    Returns count of new rows inserted.
    """
    to_insert = []

    for line in proxy_lines:
        parsed = parse_proxy_string(line)
        if not parsed:
            logger.warning(f"Failed to parse proxy: {line}")
            continue

        to_insert.append({
            "raw_text": line.strip(),
            "ip": parsed["ip"],
            "port": parsed["port"],
            "username": parsed["username"],
            "password": parsed["password"],
        })

    if not to_insert:
        logger.info("No valid proxies to ingest")
        return 0

    try:
        # Supabase upsert with on_conflict
        response = db.table("proxies").upsert(
            to_insert,
            on_conflict="raw_text",
        ).execute()
        
        inserted = len(response.data) if response.data else 0
        logger.info(f"Ingested {inserted} new proxies")
        return inserted

    except Exception as e:
        logger.error(f"Ingest error: {e}")
        return 0


def get_next_proxy() -> Optional[Dict[str, Any]]:
    """
    Fetch the next proxy to test from the pool.
    - Filters is_active = true
    - Orders by last_tested_at ASC NULLS FIRST (never-tested first)
    - Returns single row: {id, ip, port, username, password}
    """
    try:
        response = db.table("proxies").select(
            "id, ip, port, username, password"
        ).eq("is_active", True).order(
            "last_tested_at",
            desc=False,  # ASC
            nullsfirst=True,
        ).limit(1).execute()

        if response.data and len(response.data) > 0:
            return response.data[0]
        return None

    except Exception as e:
        logger.error(f"Failed to fetch next proxy: {e}")
        return None


def mark_proxy_dead(proxy_id: str) -> bool:
    """
    Mark proxy as dead (is_active = false) after failed MTProto probe.
    """
    try:
        db.table("proxies").update({
            "is_active": False,
            "last_tested_at": datetime.utcnow().isoformat() + "Z",
        }).eq("id", proxy_id).execute()
        logger.info(f"Marked proxy {proxy_id} as dead")
        return True
    except Exception as e:
        logger.error(f"Failed to mark proxy dead: {e}")
        return False


def mark_proxy_healthy(proxy_id: str) -> bool:
    """
    Mark proxy as healthy (is_active = true) after successful MTProto probe.
    """
    try:
        db.table("proxies").update({
            "is_active": True,
            "last_tested_at": datetime.utcnow().isoformat() + "Z",
        }).eq("id", proxy_id).execute()
        logger.info(f"Marked proxy {proxy_id} as healthy")
        return True
    except Exception as e:
        logger.error(f"Failed to mark proxy healthy: {e}")
        return False


# ============================================================================
# TELETHON MTProto PROBE
# ============================================================================

async def probe_proxy_mtproto(
    ip: str,
    port: int,
    username: Optional[str] = None,
    password: Optional[str] = None,
) -> bool:
    """
    Test if proxy can establish MTProto connection to Telegram.
    
    Returns True if handshake succeeds, False on any network/auth error.
    Handles timeout, connection refused, auth key errors gracefully.
    """
    session_name = f"{ip}_{port}"
    client = None

    try:
        # Build proxy tuple for Telethon
        # Telethon expects the proxy in the form:
        # ('socks5', host, port, rdns, username?, password?)
        # For SOCKS5 with auth include username/password, else omit them.
        if username and password:
            proxy = ('socks5', ip, port, True, username, password)
        else:
            proxy = ('socks5', ip, port, False)

        client = TelegramClient(
            session=session_name,
            api_id=TELEGRAM_API_ID,
            api_hash=TELEGRAM_API_HASH,
            proxy=proxy,
            timeout=PROBE_TIMEOUT,
        )

        # Attempt connection (no login needed, just handshake)
        await asyncio.wait_for(client.connect(), timeout=PROBE_TIMEOUT)

        # Successful MTProto handshake
        logger.info(f"✓ Proxy {ip}:{port} is HEALTHY")
        return True

    except asyncio.TimeoutError:
        logger.warning(f"✗ Proxy {ip}:{port} timeout")
        return False

    except TelethonConnectionError as e:
        logger.warning(f"✗ Proxy {ip}:{port} connection error: {e}")
        return False

    except AuthKeyError as e:
        logger.warning(f"✗ Proxy {ip}:{port} auth key error: {e}")
        return False

    except RPCError as e:
        logger.warning(f"✗ Proxy {ip}:{port} RPC error: {e}")
        return False

    except Exception as e:
        logger.error(f"✗ Proxy {ip}:{port} unexpected error: {type(e).__name__}: {e}")
        return False

    finally:
        if client:
            try:
                await client.disconnect()
            except Exception as e:
                logger.debug(f"Disconnect error (ignored): {e}")


# ============================================================================
# WORKER MAIN LOOP
# ============================================================================

async def worker_cycle():
    """
    Single cycle of the worker:
    1. Fetch next proxy from pool
    2. Run MTProto probe
    3. Update DB status
    4. Sleep briefly before next cycle
    """
    proxy = get_next_proxy()

    if not proxy:
        logger.debug("No active proxies in pool, sleeping...")
        await asyncio.sleep(WORKER_CYCLE_DELAY)
        return

    proxy_id = proxy["id"]
    ip = proxy["ip"]
    port = proxy["port"]
    username = proxy.get("username")
    password = proxy.get("password")

    logger.info(f"Testing proxy {ip}:{port} (id={proxy_id})")

    # Run MTProto probe
    is_healthy = await probe_proxy_mtproto(ip, port, username, password)

    # Update DB
    if is_healthy:
        mark_proxy_healthy(proxy_id)
    else:
        mark_proxy_dead(proxy_id)

    await asyncio.sleep(WORKER_CYCLE_DELAY)


async def main():
    """
    Main worker loop. Runs indefinitely, probing proxies from the pool.
    """
    logger.info("🚀 Proxy Mainframe Worker started")
    logger.info(f"Config: MAX_CONCURRENT={MAX_CONCURRENT_PROBES}, TIMEOUT={PROBE_TIMEOUT}s")

    try:
        while True:
            await worker_cycle()

    except KeyboardInterrupt:
        logger.info("Worker interrupted by user")
    except Exception as e:
        logger.error(f"Worker fatal error: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(main())
