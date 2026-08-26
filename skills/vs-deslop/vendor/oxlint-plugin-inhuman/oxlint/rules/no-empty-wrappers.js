import { createFunctionLikeVisitors, unwrapExpression } from "./ast.js";

const NO_EMPTY_WRAPPERS_MESSAGE =
	"Do not write empty wrapper functions. Use the implementation directly or add real behavior.";

function getCallExpression(value) {
	const expr = unwrapExpression(value);
	return expr?.type === "CallExpression" ? expr : null;
}

function getIdentifierExpression(value) {
	const expr = unwrapExpression(value);
	return expr?.type === "Identifier" ? expr : null;
}

function getCallExpressionFromStatement(statement) {
	if (statement == null) {
		return null;
	}

	if (statement.type === "ExpressionStatement") {
		return getCallExpression(statement.expression);
	}

	if (statement.type === "ReturnStatement") {
		return getCallExpression(statement.argument);
	}

	return null;
}

function getSingleDeclarator(statement) {
	if (statement?.type !== "VariableDeclaration" || statement.declarations.length !== 1) {
		return null;
	}

	return statement.declarations[0];
}

function getReturnedName(statement) {
	if (statement?.type !== "ReturnStatement") {
		return null;
	}

	return getIdentifierExpression(statement.argument)?.name ?? null;
}

function getReturnedDeclarator(declaration, returnStatement) {
	const declarator = getSingleDeclarator(declaration);
	const returnedName = getReturnedName(returnStatement);
	if (declarator?.id?.type !== "Identifier" || returnedName == null) {
		return null;
	}

	return declarator.id.name === returnedName ? declarator : null;
}

function getAssignmentExpression(statement) {
	const expression = unwrapExpression(statement?.expression);
	if (expression?.type !== "AssignmentExpression" || expression.operator !== "=") {
		return null;
	}

	return expression;
}

function getTemporaryReturnCallExpression(statements) {
	const declarator = getReturnedDeclarator(statements[0], statements[1]);
	if (declarator == null) {
		return null;
	}

	return getCallExpression(declarator.init);
}

function getAssignedReturnCallExpression(statements) {
	const declarator = getReturnedDeclarator(statements[0], statements[2]);
	if (declarator == null || declarator.init != null) {
		return null;
	}

	const assignment = getAssignmentExpression(statements[1]);
	if (assignment == null) {
		return null;
	}

	if (assignment.left?.type !== "Identifier" || assignment.left.name !== declarator.id.name) {
		return null;
	}

	return getCallExpression(assignment.right);
}

function getWrapperCallExpression(statements) {
	if (statements.length === 1) {
		return getCallExpressionFromStatement(statements[0]);
	}

	if (statements.length === 2) {
		return getTemporaryReturnCallExpression(statements);
	}

	if (statements.length === 3) {
		return getAssignedReturnCallExpression(statements);
	}

	return null;
}

function getPassThroughParams(params) {
	const names = [];
	let restName = null;

	for (const param of params ?? []) {
		if (param.type === "Identifier") {
			names.push(param.name);
			continue;
		}

		if (param.type === "RestElement" && param.argument?.type === "Identifier") {
			restName = param.argument.name;
			continue;
		}

		return null;
	}

	return { names, restName };
}

function argsMatchNames(args, names) {
	if (args.length < names.length) {
		return false;
	}

	return names.every((name, index) => {
		const arg = args[index];
		return arg?.type === "Identifier" && arg.name === name;
	});
}

function restArgMatches(arg, restName) {
	if (restName == null) {
		return true;
	}

	return (
		arg?.type === "SpreadElement"
		&& arg.argument?.type === "Identifier"
		&& arg.argument.name === restName
	);
}

function isPassThroughWrapper(node, callExpression) {
	const params = getPassThroughParams(node.params);
	if (params == null) {
		return false;
	}

	const args = callExpression.arguments ?? [];
	const expectedLength = params.names.length + (params.restName == null ? 0 : 1);
	if (args.length !== expectedLength) {
		return false;
	}

	if (!argsMatchNames(args, params.names)) {
		return false;
	}

	return restArgMatches(args[args.length - 1], params.restName);
}

function checkFunctionLike(context, node) {
	const statements = node.body?.type === "BlockStatement" ? node.body.body ?? [] : [];
	const callExpression = getWrapperCallExpression(statements);
	if (!callExpression || !isPassThroughWrapper(node, callExpression)) {
		return;
	}

	context.report({
		node,
		messageId: "noEmptyWrapper",
	});
}

export const noEmptyWrappersRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow empty wrapper functions that only pass through to a single call.",
			recommended: false,
		},
		schema: [],
		messages: {
			noEmptyWrapper: NO_EMPTY_WRAPPERS_MESSAGE,
		},
	},
	create(context) {
		return createFunctionLikeVisitors((node) => {
			checkFunctionLike(context, node);
		});
	},
};
