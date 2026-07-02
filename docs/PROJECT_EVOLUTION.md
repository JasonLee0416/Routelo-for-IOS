# Project Evolution

Routelo v2 was not designed in one pass. It combines findings from two smaller
prototypes that tested different parts of a delivery driver's workflow.

## 1. Routelo: Can Mobile Route Entry Be Simpler?

The first Routelo prototype focused on map interaction:

- request the driver's location;
- geocode typed destinations;
- show stops on a map;
- estimate distance;
- reorder stops with a nearest-neighbor heuristic.

### What Worked

The prototype made the core interaction concrete: a driver could build a stop
list and ask the app for a suggested order.

### What Failed

The experiment started too late in the workflow. A driver still had to read
paper receipts and type every destination. It also treated each stop as a
coordinate, ignoring strict delivery deadlines, event times, contacts, and
source documents.

Repository: [Routelo](https://github.com/JasonLee0416/Routelo)

## 2. Flogg: Can Receipts Become Searchable Records?

Flogg moved upstream and tested receipt capture:

- camera and batch capture;
- multimodal model extraction;
- editable receipt fields;
- SQLite persistence;
- search and date-grouped history.

### What Worked

It validated the capture-to-record interaction and showed that local receipt
history could reduce repeated manual handling.

### What Failed

Direct cloud model output was too opaque and risky:

- provider keys could not safely live in a mobile client;
- extracted fields lacked evidence and confidence;
- unmatched data could be silently lost;
- receipt records were disconnected from routes and delivery status.

Repository: [Flogg](https://github.com/JasonLee0416/Flogg)

## 3. Routelo v2: Integrating the Workflow

Routelo v2 joins the two experiments around a stricter data boundary.

| Earlier finding | Routelo v2 response |
|---|---|
| Stops need operational context | Delivery records include deadlines and event times |
| OCR output is uncertain | Field confidence and human review |
| Parser failures must be visible | Raw, normalized, and unmapped layers |
| Vendor labels vary | Alias registry and fuzzy matching |
| Connectivity is unreliable | Local-first record design |
| Routes need a trusted navigator | Suggested order with Google Maps handoff |

## Current Engineering Question

The project is now testing whether a delivery tool can provide useful
automation without hiding uncertainty from the driver.

The next proof points are native on-device OCR, address validation, real-device
performance, parser tests, and production-grade local data protection.
