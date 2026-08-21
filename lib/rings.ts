import { parseRingSelection, type RingSelection } from "./config";
import { stored } from "./storage";

export const ringStore = stored<RingSelection>("ring-auditor.rings", parseRingSelection);
