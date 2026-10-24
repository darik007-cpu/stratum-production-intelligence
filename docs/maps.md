# Geographic reference map

STRATUM's Regional map is a real, interactive OpenStreetMap basemap rendered with Leaflet 1.9.4. Its industrial console opens on the western Kazakhstan / Caspian regional viewport. A sector selector offers Kazakhstan, Atyrau and the Caspian view; the adjacent console contains terrain links and public field searches. It supports dragging, touch zoom, keyboard panning, zoom controls and Country extent. Scroll-wheel zoom is disabled so the map does not capture page scrolling. Google Maps, Google satellite and OpenStreetMap links follow the current viewport and open an external provider in a new tab.

The map provides geographic context only. Demo Karatau wells, facilities, operating boundaries and pipelines are not placed on it. The illustrative 3D field remains separate. Public Google Maps searches for Tengiz and Kashagan use names, not invented coordinates; search results neither establish a validated asset position nor connect either field to the demo data. Basemap content is not operational telemetry.

## Reference viewports and sources

| View                         | Center / zoom       | Basis                                                                                                                                                                    |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kazakhstan                   | 48, 67 / 5          | A chosen country-scale viewport, not a surveyed point.                                                                                                                   |
| Atyrau city vicinity         | 47.106, 51.921 / 10 | Rounded from a public promenade's 47.10606, 51.92095 coordinates on [Kazakhstan Travel](https://kazakhstan.travel/en/attractions/133). It is not an oilfield coordinate. |
| Western Kazakhstan / Caspian | 46, 51 / 6          | A chosen broad regional viewport without asset overlays.                                                                                                                 |

Fit Kazakhstan uses approximate view bounds `[40.6, 46.5]` to `[55.4, 87.4]` with padding. They frame the country and do not define an operational or national boundary. Sources checked 23 October 2026.

## Providers and operation

Tiles are normal browser images from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. Attribution to © OpenStreetMap contributors is visible on and beneath the map. The component preserves normal browser caching and referrer behavior, has no bulk-prefetch or offline-pack facility, and makes no geolocation request. A one-tile immediate viewport buffer is retained by Leaflet. See the [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/).

Internet access is required. Tile failures and offline status show a visible notice with retry and external-provider alternatives. If map initialization fails, provider links remain usable. Google links follow the official [Maps URLs documentation](https://developers.google.com/maps/documentation/urls/get-started): `api=1`, display-map center and zoom, optional `basemap=satellite`, and the name-based search action. No Google API key or embedded Google imagery is used.

For production traffic, assess the tile provider's service terms and capacity, supply a contact and maintain attribution and referrer headers. OSM's public tile service is best effort. See the [Leaflet API](https://leafletjs.com/reference.html) for the implemented map lifecycle and controls. Browser tile rendering, provider-link and failure-path results should be recorded in the verification document separately from build results.
