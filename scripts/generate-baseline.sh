#!/usr/bin/env bash

# Generate performance baseline for kustomark
# This script runs a comprehensive benchmark suite and saves the results as a baseline

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASELINE_NAME="main"
SUITE="full"
RUNS=20
WARMUP=5
OUTPUT_DIR="benchmarks/baselines"

# Usage information
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Generate a performance baseline for kustomark benchmarks.

OPTIONS:
    -n, --name NAME         Baseline name (default: main)
    -s, --suite SUITE       Benchmark suite: quick|full (default: full)
    -r, --runs NUM          Number of benchmark runs (default: 20)
    -w, --warmup NUM        Number of warmup runs (default: 5)
    -o, --output DIR        Output directory (default: benchmarks/baselines)
    -h, --help              Show this help message

EXAMPLES:
    # Generate default baseline
    $0

    # Generate quick baseline for testing
    $0 --name test --suite quick --runs 10

    # Generate baseline with custom parameters
    $0 --name v1.0.0 --runs 50 --warmup 10

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            BASELINE_NAME="$2"
            shift 2
            ;;
        -s|--suite)
            SUITE="$2"
            shift 2
            ;;
        -r|--runs)
            RUNS="$2"
            shift 2
            ;;
        -w|--warmup)
            WARMUP="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

# Validate baseline name
if [[ ! "$BASELINE_NAME" =~ ^[a-zA-Z0-9._-]+$ ]]; then
    echo -e "${RED}Error: Invalid baseline name. Use only alphanumeric characters, dots, hyphens, and underscores.${NC}"
    exit 1
fi

if [[ "$BASELINE_NAME" == "latest" ]]; then
    echo -e "${RED}Error: 'latest' is a reserved name. Please use a different name.${NC}"
    exit 1
fi

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Kustomark Performance Baseline Generator               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Baseline Name:    ${GREEN}$BASELINE_NAME${NC}"
echo -e "  Suite:            ${GREEN}$SUITE${NC}"
echo -e "  Runs:             ${GREEN}$RUNS${NC}"
echo -e "  Warmup:           ${GREEN}$WARMUP${NC}"
echo -e "  Output Directory: ${GREEN}$OUTPUT_DIR${NC}"
echo ""

# Check if bun is available
if ! command -v bun &> /dev/null; then
    echo -e "${RED}Error: bun is not installed or not in PATH${NC}"
    echo "Please install bun: https://bun.sh"
    exit 1
fi

# Build the project if needed
if [[ ! -f "dist/cli/index.js" ]]; then
    echo -e "${YELLOW}Building project...${NC}"
    bun run build
    echo ""
fi

# Generate timestamp
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Run benchmarks
echo -e "${YELLOW}Running benchmark suite...${NC}"
echo ""

TEMP_OUTPUT="benchmark-results-$$.json"

if ! bun run scripts/run-benchmarks.ts \
    --suite "$SUITE" \
    --runs "$RUNS" \
    --warmup "$WARMUP" \
    --output "$TEMP_OUTPUT"; then
    echo -e "${RED}Error: Benchmark suite failed${NC}"
    rm -f "$TEMP_OUTPUT"
    exit 1
fi

# Verify output file
if [[ ! -f "$TEMP_OUTPUT" ]]; then
    echo -e "${RED}Error: Benchmark output file not found${NC}"
    exit 1
fi

# Move to final location
OUTPUT_FILE="$OUTPUT_DIR/$BASELINE_NAME.json"
mv "$TEMP_OUTPUT" "$OUTPUT_FILE"

echo ""
echo -e "${GREEN}✓ Baseline generated successfully!${NC}"
echo -e "  File: ${BLUE}$OUTPUT_FILE${NC}"

# Display summary
if command -v jq &> /dev/null; then
    echo ""
    echo -e "${YELLOW}Summary:${NC}"
    RESULT_COUNT=$(jq '.results | length' "$OUTPUT_FILE")
    TOTAL_OPS=$(jq '.summary.totalOperations' "$OUTPUT_FILE")
    AVG_THROUGHPUT=$(jq '.summary.averageThroughput' "$OUTPUT_FILE")

    echo -e "  Total Results:        ${GREEN}$RESULT_COUNT${NC}"
    echo -e "  Total Operations:     ${GREEN}$TOTAL_OPS${NC}"
    echo -e "  Average Throughput:   ${GREEN}$(printf "%.2f" "$AVG_THROUGHPUT") files/sec${NC}"
fi

echo ""
echo -e "${BLUE}To use this baseline in comparisons:${NC}"
echo -e "  ${GREEN}bun run scripts/compare-benchmarks.ts --baseline $OUTPUT_FILE --current <new-results.json>${NC}"
echo ""
echo -e "${BLUE}To update in CI/CD:${NC}"
echo -e "  ${GREEN}cp $OUTPUT_FILE benchmarks/baselines/main.json${NC}"
echo ""

exit 0
