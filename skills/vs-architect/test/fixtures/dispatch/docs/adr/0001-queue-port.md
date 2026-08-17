# ADR 0001: Keep queue providers behind QueuePort

The application owns `QueuePort`. Production and test adapters satisfy it so
Job Dispatch does not depend on a vendor SDK. Preserve this seam when changing
Dispatch behavior.
