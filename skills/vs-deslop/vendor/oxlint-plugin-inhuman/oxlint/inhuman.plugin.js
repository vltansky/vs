/**
 * vs-owned Oxlint JS plugin entry for the pinned oxlint-plugin-inhuman
 * commit. Registers only the leftover catch/wrapper rules enabled by
 * vs-deslop. Other upstream rules are not loaded (and oxlint-plugin-no-branching
 * is not vendored).
 */
import { noEmptyWrappersRule } from "./rules/no-empty-wrappers.js";
import { noSwallowedCatchRule } from "./rules/no-swallowed-catch.js";

export default {
	meta: {
		name: "inhuman",
	},
	rules: {
		"no-empty-wrappers": noEmptyWrappersRule,
		"no-swallowed-catch": noSwallowedCatchRule,
	},
};
