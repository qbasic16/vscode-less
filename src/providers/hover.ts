'use strict';

import {
	Hover,
	MarkedString
} from 'vscode-languageserver';

import { INode, NodeType } from '../types/nodes';
import { ISymbols, IVariable, IMixin } from '../types/symbols';

import { getDocumentPath } from '../utils/path';
import { getCurrentDocumentImports } from '../utils/document';

/**
 * Returns the parent Node of the specified type.
 *
 * @param {INode} node
 * @param {NodeType} type
 * @returns {INode}
 */
function getParentNodeByType(node: INode, type: NodeType): INode {
	while (true) {
		if (node.type === NodeType.Stylesheet) {
			return null;
		} else if (node.type === type) {
			break;
		}

		node = node.getParent();
	}

	return node;
}

/**
 * Returns a colored (marked) line for Variable.
 *
 * @param {IVariable} symbol
 * @param {string} fsPath
 * @param {string} suffix
 * @returns {MarkedString}
 */
function makeVariableAsMarkedString(symbol: IVariable, fsPath: string, suffix: string): MarkedString {
	if (fsPath !== 'current') {
		suffix = `\n@import "${fsPath}"` + suffix;
	}

	return {
		language: 'less',
		value: `${symbol.name}: ${symbol.value}` + suffix
	};
}

/**
 * Returns a colored (marked) line for Mixin.
 *
 * @param {IMixin} symbol
 * @param {string} fsPath
 * @param {string} suffix
 * @returns {MarkedString}
 */
function makeMixinAsMarkedString(symbol: IMixin, fsPath: string, suffix: string): MarkedString {
	const args = symbol.parameters.map((item) => `${item.name}: ${item.value}`).join(', ');
	const fullName = symbol.parent ? symbol.parent + ' ' + symbol.name : symbol.name;

	if (fsPath !== 'current') {
		suffix = `\n@import "${fsPath}"` + suffix;
	}

	return {
		language: 'less',
		value: fullName + `(${args}) {\u2026}` + suffix
	};
}

interface ISymbol {
	document: string;
	path: string;
	info: any;
}

/**
 * Returns the Symbol, if it present in the documents.
 *
 * @param {ISymbols[]} symbolList
 * @param {*} identifier
 * @param {string} currentPath
 * @returns {ISymbol}
 */
function getSymbol(symbolList: ISymbols[], identifier: any, currentPath: string): ISymbol {
	for (let i = 0; i < symbolList.length; i++) {
		const symbols = symbolList[i];
		const symbolsByType = symbols[identifier.type];

		const fsPath = getDocumentPath(currentPath, symbols.document);

		for (let i = 0; i < symbolsByType.length; i++) {
			if (symbolsByType[i].name === identifier.name) {
				return {
					document: symbols.document,
					path: fsPath,
					info: symbolsByType[i]
				};
			}
		}
	}

	return null;
}

export function doHover(currentPath: string, symbolsList: ISymbols[], hoverNode: INode): Hover {
	if (!hoverNode || !hoverNode.type) {
		return;
	}

	let identifier: { type: string; name: string; } = null;
	if (hoverNode.type === NodeType.VariableName) {
		identifier = {
			name: hoverNode.getName(),
			type: 'variables'
		};
	} else if (hoverNode.type === NodeType.Identifier) {
		let node = getParentNodeByType(hoverNode, NodeType.MixinDeclaration) || getParentNodeByType(hoverNode, NodeType.MixinReference);
		if (node) {
			identifier = {
				name: node.getName(),
				type: 'mixins'
			};
		}
	}

	if (!identifier) {
		return;
	}

	// Imports for current document
	const documentImports = getCurrentDocumentImports(symbolsList, currentPath);

	// All symbols
	const symbol = getSymbol(symbolsList, identifier, currentPath);

	// Content for Hover popup
	let contents: MarkedString = '';
	if (symbol) {
		// Add 'implicitly' suffix if the file imported implicitly
		let contentSuffix = '';
		if (symbol.path !== 'current' && documentImports.indexOf(symbol.document) === -1) {
			contentSuffix = ' (implicitly)';
		}

		if (identifier.type === 'variables') {
			contents = makeVariableAsMarkedString(symbol.info, symbol.path, contentSuffix);
		} else {
			contents = makeMixinAsMarkedString(symbol.info, symbol.path, contentSuffix);
		}
	}

	return {
		contents: contents
	};
}