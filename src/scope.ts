import * as vscode from 'vscode';
import { SymbolKind } from 'vscode';

const ScopeSymbolKind = [
    SymbolKind.Method,
    SymbolKind.Function,
    SymbolKind.Class,
    SymbolKind.Namespace,
    SymbolKind.Module,
    SymbolKind.Object,
    SymbolKind.Constructor,
];

export class ScopeSymbolProvider {
    private doc: vscode.TextDocument | any;
    private selection: vscode.Selection | any;

    constructor() {
        let editor = vscode.window.activeTextEditor;
        this.doc = null;
        if (editor) {
            this.doc = editor.document;
            this.selection = editor.selection;
        }
    }

    private getSymbols(): Thenable<vscode.SymbolInformation[] | undefined> {
        return vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', this.doc.uri);
    }

    public async getScopeSymbols(): Promise<vscode.SymbolInformation[]> {
        let symbols = await this.getSymbols();
        let symbolPath: vscode.SymbolInformation[] = [];
        return new Promise<vscode.SymbolInformation[]>(resolve  => {
            if (symbols && this.selection) {
                let scopeSymbols = symbols.filter(sym => ScopeSymbolKind.indexOf(sym.kind) !== -1);
                scopeSymbols.forEach(sym => {
                    var current = sym.location.range.contains(this.selection);
                    if (current) {
                        symbolPath.push(sym);
                    }
                });
            }
            return resolve(symbolPath);
        });
    }
}