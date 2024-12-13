import "@testing-library/jest-dom/vitest";
import { DateTime, Settings as LuxonSettings } from "luxon";

// Configure Luxon globally for all tests
LuxonSettings.defaultZone = "utc";
LuxonSettings.throwOnInvalid = true;

// Set a fixed start time for all tests
const referenceDate = 1733055717000; // 2024-12-01T12:21:57.000Z
const offset = DateTime.now().toMillis() - referenceDate;
LuxonSettings.now = () => Date.now() - offset; // 2024-12-01T12:21:57.000Z
