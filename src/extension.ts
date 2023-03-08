// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const HINT_DATA_FILES = {
	WORD: `${__dirname}/../hint_data/words.json`
};

const QUOTES = '\'\"';

const DOCUMENT_SELECTOR = ['markdown', 'latex'];

var wordCompletionItems: any[] = [], wordItems: any[] = [];

function loadHintData(){
	wordCompletionItems = [];
	wordItems = require(HINT_DATA_FILES.WORD);
	// window.alert(len(wordItems));
	// console.log(wordItems.length);
	wordItems.forEach((word: any)  => {
		let item = new vscode.CompletionItem(word.name, vscode.CompletionItemKind.Text);
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

function getTextBeforequestion(document: vscode.TextDocument, position: vscode.Position){
	const beforeText = document.lineAt(position.line).text.substr(0, position.character-1);
	return beforeText;
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

function searchHintEnglishCompletionItems(englishkeyword: string) {
	// console.log(keyword)
	if (englishkeyword) {return wordCompletionItems.filter(it => it.label.startsWith(englishkeyword));}
	else return []
}

function searchHintChineseCompletionItems(chineseKeyword: string) {
	// console.log(keyword)
	if (chineseKeyword) {
		let completionList = wordCompletionItems.filter(it => it.detail.indexOf(chineseKeyword) != -1);
		return completionList
	}
	else return []
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
				const char = document.lineAt(position.line).text.substr(position.character-1,position.character);
				if(char == '?' || char =='?'){
					let beforeText = getTextBeforequestion(document, position);
					let chineseKeyword = (beforeText.match(/[\u4E00-\u9FA5]+$/) || [''] )[0];
					let items = searchHintChineseCompletionItems(chineseKeyword);
					let replaceRange = new vscode.Range(position.line, 
														position.character - chineseKeyword.length - 1, 
														position.line, 
														position.character);
					let completionList: vscode.CompletionItem[] = []
					items.forEach((word: any) => {
						let item = new vscode.CompletionItem(word.name, vscode.CompletionItemKind.Function);
						item.documentation = word.documentation;
						item.detail = word.detail;
						item.label = word.label;
						item.additionalTextEdits = [vscode.TextEdit.delete(replaceRange)];
						completionList.push(item);
					});
					return new vscode.CompletionList(completionList);
				}
				

				let beforeText = getTextBeforeCursor(document, position);
				// console.log(beforeText)
				if (isCursorInTheString(beforeText)) {return []}
				// . 匹配除换行符 \n 之外的任何单字符。
				// \b 匹配一个单词边界，即字与空格间的位置。
				// ? 匹配前面的子表达式零次或一次。
				// keyword 是匹配光标之前的字符串
				let englishKeyword = (beforeText.match(/^.*?\b(\w*)$/) || ['', ''])[1];
				
				// console.log(keyword)
				// if (!englishKeyword) {return wordCompletionItems};
				// if (!chineseKeyword) {return wordCompletionItems};
				// keyword = beforeText;
				let items = searchHintEnglishCompletionItems(englishKeyword);
				// 大写开头的单词不能不全，转成小写搜索一遍
				if (items.length == 0 && englishKeyword != '') {
					items = searchHintEnglishCompletionItems(englishKeyword.toLowerCase());
				} 
				return new vscode.CompletionList(items, false) ;
			}
		}, "?"
		
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


	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "hello-extension" is now active!');
	console.log('====================================================');
	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('words-hint.hello', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from words-hint!');
	});


	subscriptions.push(englishProvider);
	subscriptions.push(hoverInformationProvider);
	subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
