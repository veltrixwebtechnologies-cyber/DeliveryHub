# Delivery navigation patch

Navigation waits for a recent, precise GPS fix and confirmed pickup/drop-off pins. It requests road geometry from OSRM, switches the destination after pickup, cancels obsolete requests, and measures progress against road segments. Missing pins or routing failures are shown explicitly; no straight line is presented as a road route. The live map and location sync use the same accepted GPS fix, and offline fixes are not replayed as fresh locations.

## Validation

- `npm run test:maps`: coordinate validation, seller pickup normalization, GPS quality/freshness, road progress, failed routing, cancellation races, and the actual navigation hook lifecycle.
- `npx tsc --noEmit`
- `npm run build`
- Browser preview checked with synthetic GPS, real OSRM responses, and pickup-to-customer phase transitions. Backend writes were mocked in that preview.

## Rollout checks

Use the matching `amrs-map-patch` branches of VendorAdmin and locc. Existing sellers with missing or incorrect pickup coordinates must confirm their entrance pin in VendorAdmin. Existing orders with missing or incorrect delivery coordinates require correction through the normal operational process; this patch does not guess or migrate locations.

No database migrations or backend deployments are included. Test an authenticated delivery on a phone over HTTPS (or localhost), with precise location enabled, from acceptance through pickup and delivery. Verify GPS updates reach the customer map, off-route recalculation works, and loss of GPS/network is clearly indicated.

Routes use the existing public OSRM car profile, not motorcycle-specific restrictions or live traffic. Network availability and map data affect routing; errors are explicit. Do not interpret this patch as offline navigation or a guarantee of road accessibility.

## 12 September integration

The original patch history and current main have been merged without rewriting commits. Additional location fixes and regression tests are included. See [LOCATION-FIX-REPORT.md](LOCATION-FIX-REPORT.md) for the complete cross-repository report, validation, and rollout requirements.
