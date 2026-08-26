function isFunctionLike(node) {
	return node?.type === "FunctionDeclaration" || isFunctionExpression(node);
}

function walkChild(child, state, visit) {
	const values = Array.isArray(child) ? child : [child];
	for (const value of values) {
		walkNode(value, state, visit);
	}
}

function walkNode(node, state, visit) {
	if (node == null || typeof node.type !== "string") {
		return;
	}

	if (node !== state.root && isFunctionLike(node)) {
		return;
	}

	visit(node);
	for (const key of state.visitorKeys[node.type] ?? []) {
		walkChild(node[key], state, visit);
	}
}

const TYPEBOX_MODULE = "typebox";
const TYPEBOX_VALUE_MODULE = "typebox/value";

function callCallee(node) {
	const expression = unwrapExpression(node);
	if (expression?.type !== "CallExpression") {
		return null;
	}

	return unwrapExpression(expression.callee);
}

function collectTypeImport(specifier, bindings) {
	if (specifier.type === "ImportNamespaceSpecifier") {
		bindings.typeNamespaces.add(specifier.local.name);
		return;
	}

	const importsType = specifier.type === "ImportSpecifier"
		&& getStaticPropertyName(specifier.imported) === "Type";
	if (specifier.type === "ImportDefaultSpecifier" || importsType) {
		bindings.typeObjects.add(specifier.local.name);
	}
}

function collectValueImport(specifier, bindings) {
	if (specifier.type === "ImportNamespaceSpecifier") {
		bindings.valueNamespaces.add(specifier.local.name);
		return;
	}

	if (specifier.type !== "ImportSpecifier") {
		return;
	}

	bindings.valueFunctions.set(
		specifier.local.name,
		getStaticPropertyName(specifier.imported),
	);
}

function isTypeObject(node, bindings) {
	const expression = unwrapExpression(node);
	if (expression?.type === "Identifier") {
		return bindings.typeObjects.has(expression.name);
	}

	if (expression?.type !== "MemberExpression") {
		return false;
	}

	const object = unwrapExpression(expression.object);
	return object?.type === "Identifier"
		&& bindings.typeNamespaces.has(object.name)
		&& getStaticPropertyName(expression.property) === "Type";
}

export function getStaticPropertyName(node) {
	if (node?.type === "Identifier") {
		return node.name;
	}

	if (node?.type === "Literal" && typeof node.value === "string") {
		return node.value;
	}

	return null;
}

export function getSourceCode(context) {
	return (
		context.sourceCode
			?? (typeof context.getSourceCode === "function" ? context.getSourceCode() : null)
	);
}

export function unwrapExpression(node) {
	let current = node;

	while (current != null) {
		if (current.type === "AwaitExpression") {
			current = current.argument;
			continue;
		}

		if (
			current.type === "ChainExpression"
			|| current.type === "ParenthesizedExpression"
			|| current.type === "TSAsExpression"
			|| current.type === "TSNonNullExpression"
			|| current.type === "TSSatisfiesExpression"
			|| current.type === "TSTypeAssertion"
		) {
			current = current.expression;
			continue;
		}

		break;
	}

	return current;
}

export function isFunctionExpression(node) {
	return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

export function walkWithoutNestedFunctions(node, visitorKeys, visit) {
	walkNode(node, { root: node, visitorKeys }, visit);
}

export function walkDescendants(node, visitorKeys, visit) {
	const pending = [node];
	while (pending.length > 0) {
		const current = pending.pop();
		if (current == null || typeof current.type !== "string") {
			continue;
		}

		visit(current);
		for (const key of visitorKeys[current.type] ?? []) {
			const child = current[key];
			pending.push(...(Array.isArray(child) ? child : [child]));
		}
	}
}

export function getCalleeNameCandidates(node) {
	if (!node) {
		return [];
	}

	if (node.type === "Identifier") {
		return [node.name];
	}

	if (node.type === "CallExpression") {
		return getCalleeNameCandidates(node.callee);
	}

	if (node.type === "ChainExpression" || node.type === "ParenthesizedExpression") {
		return getCalleeNameCandidates(node.expression);
	}

	if (node.type !== "MemberExpression") {
		return [];
	}

	const objectNames = getCalleeNameCandidates(node.object);
	const propertyName = getStaticPropertyName(node.property);
	if (propertyName == null) {
		return objectNames;
	}

	const fullNames = objectNames.map((name) => `${name}.${propertyName}`);
	return [...fullNames, ...objectNames, propertyName];
}

export function getFunctionLineCount(node) {
	if (!node.loc?.start || !node.loc?.end) {
		return 0;
	}

	return node.loc.end.line - node.loc.start.line + 1;
}

export function createFunctionLikeVisitors(visit) {
	return {
		FunctionDeclaration(node) {
			const current = node;
			visit(current);
		},
		FunctionExpression(node) {
			const current = node;
			visit(current);
		},
		ArrowFunctionExpression(node) {
			const current = node;
			visit(current);
		},
	};
}

export function createTypeboxBindings() {
	return {
		typeNamespaces: new Set(),
		typeObjects: new Set(),
		valueFunctions: new Map(),
		valueNamespaces: new Set(),
	};
}

export function collectTypeboxImportBindings(node, bindings) {
	if (node.source?.value === TYPEBOX_MODULE) {
		for (const specifier of node.specifiers ?? []) {
			collectTypeImport(specifier, bindings);
		}
		return;
	}

	if (node.source?.value !== TYPEBOX_VALUE_MODULE) {
		return;
	}

	for (const specifier of node.specifiers ?? []) {
		collectValueImport(specifier, bindings);
	}
}

export function getTypeboxTypeCallName(node, bindings) {
	const callee = callCallee(node);
	if (callee?.type !== "MemberExpression" || !isTypeObject(callee.object, bindings)) {
		return null;
	}

	return getStaticPropertyName(callee.property);
}

export function getTypeboxValueCallName(node, bindings) {
	const callee = callCallee(node);
	if (callee?.type === "Identifier") {
		return bindings.valueFunctions.get(callee.name) ?? null;
	}

	if (callee?.type !== "MemberExpression") {
		return null;
	}

	const object = unwrapExpression(callee.object);
	if (object?.type !== "Identifier" || !bindings.valueNamespaces.has(object.name)) {
		return null;
	}

	return getStaticPropertyName(callee.property);
}
