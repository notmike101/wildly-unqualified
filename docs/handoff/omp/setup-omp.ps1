#requires -Version 7.2
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$packetRoot = $PSScriptRoot
$workerRoot = (Resolve-Path (Join-Path $packetRoot '../../..')).Path
$branch = (& git -C $workerRoot branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -notmatch '^work/omp-') {
    throw 'Run this setup only from a new work/omp-* worker checkout.'
}
$gitDir = (& git -C $workerRoot rev-parse --absolute-git-dir).Trim()
$commonDir = (& git -C $workerRoot rev-parse --path-format=absolute --git-common-dir).Trim()
if ($LASTEXITCODE -ne 0 -or $gitDir -eq $commonDir) {
    throw 'A linked worktree is required.'
}
& git -C $workerRoot check-ignore -q .omp/mcp.json
if ($LASTEXITCODE -ne 0) { throw '.omp/ must be ignored before local setup.' }
foreach ($command in @('node', 'npm', 'git', 'gh', 'omp')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Missing command: $command. See TOOLS.md for installed paths."
    }
}
$localSkills = Join-Path $workerRoot '.omp/skills'
New-Item -ItemType Directory -Path $localSkills -Force | Out-Null
foreach ($source in Get-ChildItem (Join-Path $packetRoot 'vendor/superpowers/skills') -Directory) {
    $target = Join-Path $localSkills $source.Name
    if (Test-Path -LiteralPath $target) {
        foreach ($file in Get-ChildItem -LiteralPath $source.FullName -File -Recurse) {
            $relative = [IO.Path]::GetRelativePath($source.FullName, $file.FullName)
            $installed = Join-Path $target $relative
            if (-not (Test-Path -LiteralPath $installed) -or
                (Get-FileHash -LiteralPath $file.FullName).Hash -ne
                (Get-FileHash -LiteralPath $installed).Hash) {
                throw "Existing skill differs: $installed. Inspect it; do not overwrite."
            }
        }
    } else {
        Copy-Item -LiteralPath $source.FullName -Destination $target -Recurse
    }
}
$serverPath = Join-Path $env:LOCALAPPDATA 'friendslop-tools/blender-mcp-venv/Scripts/blender-mcp.exe'
if (-not (Test-Path -LiteralPath $serverPath)) { throw "Missing Blender MCP executable: $serverPath" }
$entry = @{
    command = $serverPath
    args = @('--transport', 'stdio')
    env = @{ BLENDER_MCP_HOST = '127.0.0.1'; BLENDER_MCP_PORT = '9877' }
}
$configPath = Join-Path $workerRoot '.omp/mcp.json'
if (Test-Path -LiteralPath $configPath) {
    $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json -AsHashtable
    $existing = $config.mcpServers.blender_lab
    if (-not $existing -or $existing.command -ne $entry.command -or
        ($existing.args -join ' ') -ne '--transport stdio' -or
        $existing.env.BLENDER_MCP_HOST -ne '127.0.0.1' -or
        $existing.env.BLENDER_MCP_PORT -ne '9877') {
        throw 'Existing project MCP config needs a reviewed blender_lab merge; left unchanged.'
    }
} else {
    @{ mcpServers = @{ blender_lab = $entry } } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding utf8NoBOM
}
Write-Output "Project-local skills and Blender Lab config prepared in $workerRoot."
Write-Output 'Start OMP from this cwd; inspect skills and /mcp list, then probe live Blender separately.'
