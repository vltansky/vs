import { getSourceCode } from "./ast.js";

const NO_SWALLOWED_CATCH_MESSAGE =
	"Do not swallow errors in catch blocks. Handle, log, rethrow, or explicitly justify it.";

function blockHasOnlyComments(block, sourceCode) {
	if (!sourceCode) {
		return block.body.length === 0;
	}

	const text = sourceCode.getText(block);
	const inner = text.slice(1, -1).trim();
	if (inner.length === 0) {
		return true;
	}

	const withoutBlockComments = inner.replace(/\/\*[\s\S]*?\*\//g, "");
	const withoutAnyComments = withoutBlockComments.replace(/\/\/[^\n\r]*/g, "");
	return withoutAnyComments.trim().length === 0;
}

export const noSwallowedCatchRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Forbid empty or comment-only catch blocks that swallow errors.",
			recommended: false,
		},
		schema: [],
		messages: {
			noSwallowedCatch: NO_SWALLOWED_CATCH_MESSAGE,
		},
	},
	create(context) {
		const sourceCode = getSourceCode(context);

		return {
			CatchClause(node) {
				const body = node.body;
				if (!body || body.type !== "BlockStatement") {
					return;
				}

				const isStructurallyEmpty = body.body.length === 0;
				if (!isStructurallyEmpty && !blockHasOnlyComments(body, sourceCode)) {
					return;
				}

				context.report({ node: body, messageId: "noSwallowedCatch" });
			},
		};
	},
};
