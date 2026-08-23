# Universal export dashboard

## Goal

Give every customer a dashboard for exporting account activity.

## Proposed approach

- Build a new real-time export service and dashboard.
- Support desktop, mobile, offline export queues, and automatic retry.
- Store export jobs for 90 days so users can resume on another device.
- Ship the complete surface in the first release.

## Evidence

The three requests collected so far came from enterprise account admins using
desktop browsers. They need a CSV export for monthly compliance review. No
request mentioned mobile access, offline use, cross-device resume, or real-time
updates.

## Open decisions

- Is the first release for enterprise admins or every customer?
- Are mobile, offline, and cross-device edge cases relevant to the first release?
