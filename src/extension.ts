'use strict';
import * as vscode from 'vscode';
import * as scope from './scope';

export function activate(context: vscode.ExtensionContext) {
    // @TODO move runners into own file
    // @TODO move lang map here
    // @TODO fall back to file for nearest if no symbols
    // @TODO see if we can move name of task into package.json
    let runner = new TestRunner();
    let previousTask: vscode.Task | undefined;

    // ---------------
    async function getTasks(): Promise<vscode.Task[]> {
        let tasks: vscode.Task[] = [];
        if (!vscode.window.activeTextEditor) { return tasks; }
        let file = vscode.window.activeTextEditor.document.uri;

        // nearest
        let scopeProvider = new scope.ScopeSymbolProvider();
        const symbols = await scopeProvider.getScopeSymbols();
        if (symbols.length) {
            let nearestTask = runner.testMethodTask(symbols, file);
            if (nearestTask) { tasks.push(nearestTask); }
        }

        // file
        let fileTask = runner.testFileTask(file);
        if (fileTask) { tasks.push(fileTask); }

        // previous
        if (previousTask) {
             tasks.push(runner.testPreviousTask(previousTask));
        }

        // all
        let allTask = runner.testAllTask();
        if  (allTask) { tasks.push(allTask); }

        return tasks;
    }

    vscode.tasks.onDidStartTask(event => {
        if (event.execution.task.source === 'Test runner') {
            previousTask = event.execution.task;
        }
    });

	 vscode.tasks.registerTaskProvider('test-file', {
		provideTasks: () => {
            return getTasks();
		},
		resolveTask(_task: vscode.Task): vscode.Task | undefined {
			return undefined;
		}
    });
}


interface TestRunnerInterface {
    testMethodCommand(command: string, symbols: vscode.SymbolInformation[], file: string): string;
    testFileCommand(command: string, file: string): string;
    testAllCommand(command: string): string;
}

class PytestRunner implements TestRunnerInterface {
    public testMethodCommand(command: string, symbols: vscode.SymbolInformation[], file: string): string {
        const symbol: string = symbols.map(s => s.name).join("::");
        return command += " " + file + "::" + symbol;
    }

    public testFileCommand(command: string, file: string): string {
        return command += " " + file;
    }

    public testAllCommand(command: string): string {
        return command;
    }
}

class PhpunitRunner implements TestRunnerInterface {
    public testMethodCommand(command: string, symbols: vscode.SymbolInformation[], file: string): string {
        const symbol: string = symbols.map(s => s.name).join("::");
        return command += " --filter '" + symbol + "' " + file;
    }

    public testFileCommand(command: string, file: string): string {
        return command += " " + file;
    }

    public testAllCommand(command: string): string {
        return command;
    }
}


class TestRunner {
    languageMap: { [key:string]: {} } = {
        "python": { 
            "setting": "python",
            "pytest": PytestRunner,
            "phpunit": PhpunitRunner,
        }
    };

    public relativePath(uri: vscode.Uri): string {
        const workDir = vscode.workspace.getWorkspaceFolder(uri);
        if (!workDir) {
            return '';
        }
        return uri.path
            .replace(workDir.uri.path, "<>")
            .replace("<>/", "");
    }

    public testMethodTask(symbols: vscode.SymbolInformation[], file: vscode.Uri): vscode.Task | undefined {
        let relativeFile = this.relativePath(file);
        let cmd = this.getTestCommand();
        let runnerClass: any = this.getRunner();
        const workspaceDir = this.getWorkspaceDir(file);
        if (cmd && runnerClass && workspaceDir) {
            const runner: TestRunnerInterface = new runnerClass(); 
            let exec = runner.testMethodCommand(cmd, symbols, relativeFile);
            return new vscode.Task(
                { type: 'test-nearest' },
                'test current method',
                'Test runner',
                new vscode.ShellExecution(exec),
                '',
            );
        }
    }

    public testFileTask(file: vscode.Uri): vscode.Task | undefined {
        let relativeFile = this.relativePath(file);
        let cmd = this.getTestCommand();
        let runnerClass: any = this.getRunner();
        const workspaceDir = this.getWorkspaceDir(file);
        if (cmd && runnerClass && workspaceDir) {
            const runner: TestRunnerInterface = new runnerClass(); 
            let exec = runner.testFileCommand(cmd, relativeFile);
            // @TODO set cwd in task options
            return new vscode.Task(
                { type: 'test-file' },
                'test current file',
                'Test runner',
                new vscode.ShellExecution(exec),
                '',
            );
        }
    }

    public testPreviousTask(previousTask: vscode.Task) {
        return new vscode.Task(
            { type: 'test-previous' },
            'run previous test',
            'Test runner',
            previousTask.execution,
            previousTask.problemMatchers
        );
    }

    public testAllTask() {
        let cmd = this.getTestCommand();
        if (cmd) {
            let runnerClass: any = this.getRunner();
            const runner: TestRunnerInterface = new runnerClass(); 
            let exec = runner.testAllCommand(cmd);
            // @TODO set cwd in task options
            return new vscode.Task(
                { type: 'test-all' },
                'run all tests',
                'Test runner',
                new vscode.ShellExecution(exec),
                '',
            );
        }
    }

    private getRunner(): TestRunnerInterface | undefined {
        let languageId = this.getLanguageId();
        if (!languageId) { return; }

        const map: any = this.languageMap[languageId];
        const config = vscode.workspace.getConfiguration('testrunner');
        const runner = <string> config.get(map['setting']);
        return <TestRunnerInterface | undefined> map[runner];
    }

    private getWorkspaceDir(file: vscode.Uri): string | undefined {
        const config = vscode.workspace.getConfiguration('testrunner');
        let customDir = <string> config.get('customWorkspaceDirectory');
        if (customDir) {
            return customDir;
        } else {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(file);
            if (workspaceFolder) {
                return workspaceFolder.uri.path;
            }
        }
    }

    private getTestCommand(): string | undefined {
        let languageId = this.getLanguageId();
        if (!languageId) { return; }
        return <string | undefined>this.getRunnerConfig('command');
    }

    private getRunnerConfig(setting: string): string | undefined {
        let languageId = this.getLanguageId();
        if (!languageId) { return; }

        const map: any = this.languageMap[languageId];
        const config = vscode.workspace.getConfiguration('testrunner');
        const runner = <string> config.get(map['setting']);
        return config[runner][setting];
    }

    private getLanguageId(): string | undefined {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; } 
        let languageId = editor.document.languageId;
        if (!this.languageMap[languageId]) {
            vscode.window.showErrorMessage("No registered runner for language {$languageId}");
            return;
        }
        return languageId;
    }
}