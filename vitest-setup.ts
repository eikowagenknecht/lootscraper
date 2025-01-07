import "@testing-library/jest-dom/vitest";
import { DateTime, Settings as LuxonSettings } from "luxon";

// Configure Luxon globally for all tests
LuxonSettings.defaultZone = "utc";
LuxonSettings.throwOnInvalid = true;

// Set a fixed start time for all tests
const referenceDate = DateTime.fromISO("2024-12-01T15:00:00.000Z");
const offset = DateTime.now().toMillis() - referenceDate.toMillis();
LuxonSettings.now = () => Date.now() - offset;
