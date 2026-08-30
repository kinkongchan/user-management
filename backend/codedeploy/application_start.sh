#!/bin/bash
set -euo pipefail
systemctl daemon-reload
systemctl restart fastapi
