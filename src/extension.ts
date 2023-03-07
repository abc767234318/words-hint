// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const HINT_DATA_FILES = {
	WORD: `${__dirname}/../hint_data/words.json`
};

const QUOTES = '\'\"';

const DOCUMENT_SELECTOR = ['markdown', 'latex'];

let wordCompletionItems: any[] = [], wordItems: any = [];

function loadHintData(){
	var wordCompletionItems = [];
	var wordItems = require(HINT_DATA_FILES.WORD);
	// window.alert(len(wordItems));
	// console.log(wordItems.length);
	wordItems.forEach((word: any)  => {
		let item = new vscode.CompletionItem(word.name, vscode.CompletionItemKind.Function);
		item.documentation = word.desc;
		item.detail = word.set;
		// TODO
		// item.usage = word.usage;
		item.label = word.name;
		wordCompletionItems.push(item);
	});
}

function getTextBeforeCursor(document: vscode.TextDocument, position: vscode.Position){
	let start = new vscode.Position(position.line, 0);
	var range = new vscode.Range(start, position);
	return document.getText(range);
}

function isCursorInTheString(textBeforeCursor: string) {
	// TODO 考虑上一行行末是否有 \ 字符, 如果有的话就还要检测上一行
	if (textBeforeCursor.indexOf(QUOTES[0]) == -1 ||
		textBeforeCursor.indexOf(QUOTES[1]) == -1) return false;

	let len = textBeforeCursor.length, i = -1, inStr: any = false, char, qType;
	while (++i < len) {
		char = textBeforeCursor[i];
		if (char == '\\')
			i++;
		else if ((qType = QUOTES.indexOf(char)) >= 0)
			inStr = Number(inStr) == Number(QUOTES[qType]) ? false : QUOTES[qType];
	}
	return inStr;
}

function searchHintCompletionItems(keyword: string) {
	// console.log(keyword)
	return wordCompletionItems.filter(it => it.label.startsWith(keyword));
}

function getTextAroundCursor(document: vscode.TextDocument, position: vscode.Position) {
	let lineText = document.lineAt(position).text,
		pos = position.character;
	let beforeText = lineText.slice(0, pos),
		afterText = lineText.slice(pos);
	// \w匹配任何单词字符包含下划线  ===>等价于 [A-Z a-z 0-9_]
	// * 匹配前面表达式多次，^ 和 $ 分别指字符串的开始与结束
	beforeText = (beforeText.match(/\w*$/) || [''])[0];
	afterText = (afterText.match(/^\w*/) || [''])[0];
	return beforeText + afterText;
}

function findHintItem(wordname: string) {
	let item = wordItems.filter((it: any) => it.name == wordname);
	// item.length || (item = varItems.filter(it => it.name == wordname));
	return item.length ? item[0] : null;
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "words-hint" is now active!');
	var subscriptions = context.subscriptions;
	loadHintData();

	const englishProvider = vscode.languages.registerCompletionItemProvider(
		DOCUMENT_SELECTOR, {
			provideCompletionItems: function(document, position, token, context){
				let beforeText = getTextBeforeCursor(document, position);
				// console.log(beforeText)
				if (isCursorInTheString(beforeText)) {return []}
				// . 匹配除换行符 \n 之外的任何单字符。
				// \b 匹配一个单词边界，即字与空格间的位置。
				// ? 匹配前面的子表达式零次或一次。
				// keyword 是匹配光标之前的字符串
				let keyword = (beforeText.match(/^.*?\b(\w*)$/) || ['', ''])[1];
				// console.log(keyword)
				if (!keyword) {return wordCompletionItems};
				// keyword = beforeText;
				let items = searchHintCompletionItems(keyword);
				// 大写开头的单词不能不全，转成小写搜索一遍
				if (items.length == 0) {
					items = searchHintCompletionItems(keyword.toLowerCase());
				} 
				return items;
			}
		}
		
	);

	const hoverInformationProvider = vscode.languages.registerHoverProvider(
		DOCUMENT_SELECTOR, {
			provideHover: function(document, position, token): vscode.ProviderResult<vscode.Hover>{
				let beforeText = getTextBeforeCursor(document, position);
				if (isCursorInTheString(beforeText)) return null;
				let textAround = getTextAroundCursor(document, position);
				if (!textAround) return null;
				let strlen = textAround.length;
				let item = findHintItem(textAround);
				if (!item)  // 大写开头的查不到，可以变成小写再查一下
					item = findHintItem(textAround.toLowerCase());
				if (!item && textAround.charAt(strlen - 1) == "s")// 复数查不到，去掉s查一下
					item = findHintItem(textAround.substring(0, strlen - 1));
				if (!item && textAround.substring(strlen - 2, strlen) == "es")// 复数查不到，去掉es查一下
					item = findHintItem(textAround.substring(0, strlen - 2));
				if (!item && textAround.substring(strlen - 2, strlen) == "ed")// 过去式, end with ed
				{
					item = findHintItem(textAround.substring(0, strlen - 1)); // 过去式,has e, added d, 
					if (!item) {
						item = findHintItem(textAround.substring(0, strlen - 2)); //过去式, end with ed
						if (!item)
							item = findHintItem(textAround.substring(0, strlen - 3)); //过去式, 辅音字母结尾的
					}
				}
				if (!item) return null;
				return new vscode.Hover([
					`**${item.name}**`, `*${item.set}*`, item.desc
				]);
			}
	});



	subscriptions.push(englishProvider);
	subscriptions.push(hoverInformationProvider);
}

// This method is called when your extension is deactivated
export function deactivate() {}
