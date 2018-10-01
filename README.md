# Test Runner

*DO NOT USE, NOT READY YET*

A general purpose test runner that currently supports PyTest for Python and PHPUnit for PHP.

It can either run all test, the current test file, the function/method closest to the cursor or the previous test.


# Configuration

There are four tasks available that you can map to keyboard shortcuts:

- `Test runner: run all tests`
- `Test runner: test current file`
- `Test runner: test current method`
- `Test runner: run previous test`

Example keyboard mappings (`keybindings.json`):

    {
        "key": "alt+k",
        "command": "workbench.action.tasks.runTask",
        "args": "Test runner: test current method"
    }

