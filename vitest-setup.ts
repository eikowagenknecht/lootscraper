import "@testing-library/jest-dom/vitest";
import { Settings as LuxonSettings } from "luxon";

// Configure Luxon globally for all tests
LuxonSettings.defaultZone = "utc";
LuxonSettings.throwOnInvalid = true;
