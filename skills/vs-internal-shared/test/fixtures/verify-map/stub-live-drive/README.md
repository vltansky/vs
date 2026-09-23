# Checkout app verify map

## Launch

Start the app.

## Doctor

Health check on the local port returns ok true and this process owns it.

## Drive

Use the existing Playwright harness. Stable handles: getByRole and data-testid. Not coordinates.

## Evidence

Capture user path, action and result, and side effects. Proof lives under evidence/ and survives cleanup.

## Cleanup

Stop only what this run started. Scratch state goes. Evidence stays.

## Isolate

Two instances can bind separate ports with separate data dirs.
