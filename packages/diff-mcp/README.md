<p align="center">
  <img src="../../demos/html-demo/logo.svg" width="48px" align="center" alt="jsondiffpatch logo" />
  <h1 align="center">diff-mcp</h1>
  <p align="center">
    <a href="https://jsondiffpatch.com">jsondiffpatch.com</a>
    <br/>
    MCP Server to compare text or data and get a diff
  </p>
</p>

<!--- badges -->
<p align="center">
  <a href="https://github.com/benjamine/jsondiffpatch/actions?query=branch%3Amaster"><img src="https://github.com/benjamine/jsondiffpatch/actions/workflows/CI.yml/badge.svg?event=push&branch=master" alt="JsonDiffPatch CI status" /></a>
  <a href="https://twitter.com/beneidel" rel="nofollow"><img src="https://img.shields.io/badge/created%20by-@beneidel-BACABA.svg" alt="Created by Benjamin Eidelman"></a>
  <a href="https://opensource.org/licenses/MIT" rel="nofollow"><img src="https://img.shields.io/github/license/benjamine/jsondiffpatch" alt="License"></a>
  <a href="https://www.npmjs.com/package/jsondiffpatch" rel="nofollow"><img src="https://img.shields.io/npm/dw/jsondiffpatch.svg" alt="npm"></a>
  <a href="https://github.com/benjamine/jsondiffpatch" rel="nofollow"><img src="https://img.shields.io/github/stars/benjamine/jsondiffpatch" alt="stars"></a>
</p>

---

powered by [jsondiffpatch](https://github.com/benjamine/jsondiffpatch)

## Features

- compare text (using text diff powered by [google-diff-match-patch](http://code.google.com/p/google-diff-match-patch/) )
- compare data (json, json5, yaml, toml, xml, html) and get a readable diff in multiple output formats (text, json, jsonpatch)

## Tool

### diff

compare text or data and get a readable diff.

**Inputs:**
- `left` (string | unknown[] | Record<string, unknown>): left text or data
- `leftFormat` (string, optional): text, json, json5 (default), yaml, toml, xml, html
- `right` (string | unknown[] | Record<string, unknown>): right text or data (to compare with left)
- `rightFormat` (string, optional): text, json, json5 (default), yaml, toml, xml, html
- `outputFormat` (string, optional): text (default), json, jsonpatch

## Setup

### Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

``` json
{
  "mcpServers": {
    "diff": {
      "command": "npx",
      "args": [
        "-y",
        "diff-mcp"
      ]
    }
  }
}
```

## All contributors ✨

<a href="https://github.com/benjamine/jsondiffpatch/graphs/contributors">
  <p align="center">
    <img width="720" src="https://contrib.rocks/image?repo=benjamine/jsondiffpatch" alt="A table of avatars from the project's contributors" />
  </p>
</a>

## License

This MCP server is licensed under the MIT License.
This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License. For more details, please see the LICENSE file in the project repository.
