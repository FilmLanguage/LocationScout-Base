"""CLI entry point for AI Stanislavsky agents.

Usage:
    python -m src.cli location-scout --screenplay /project/screenplay.md --location "Jesse's Apartment"
"""

from __future__ import annotations

import argparse
import json
import logging
import sys


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AI Stanislavsky — Multi-Agent Film Production Pipeline"
    )
    subparsers = parser.add_subparsers(dest="agent", help="Agent to run")

    # Location Scout
    ls_parser = subparsers.add_parser("location-scout", help="Run Location Scout agent")
    ls_parser.add_argument(
        "--screenplay", required=True, help="Path to screenplay file"
    )
    ls_parser.add_argument(
        "--location", required=True, help="Location name to scout"
    )
    ls_parser.add_argument(
        "--output", default="project", help="Output directory (default: project)"
    )
    ls_parser.add_argument(
        "--bible-id", default="loc_001", help="Bible ID (default: loc_001)"
    )
    ls_parser.add_argument(
        "--verbose", "-v", action="store_true", help="Enable verbose logging"
    )

    args = parser.parse_args()

    if not args.agent:
        parser.print_help()
        sys.exit(1)

    # Configure logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    if args.agent == "location-scout":
        from src.core.agent import LocationScoutAgent

        agent = LocationScoutAgent(output_dir=args.output)
        artifacts = agent.run(
            screenplay_path=args.screenplay,
            location_name=args.location,
            bible_id=args.bible_id,
        )

        print("\n=== Location Scout Complete ===")
        print(json.dumps(artifacts, indent=2))


if __name__ == "__main__":
    main()
