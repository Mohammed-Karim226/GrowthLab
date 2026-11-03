param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$taskWorkspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$taskPrefix = $taskWorkspace + '\'

if (Test-Path -LiteralPath (Join-Path $taskWorkspace '.next/dev/lock')) {
    throw 'Stop npm run dev with Ctrl+C before cleaning its cache.'
}

# Only generated build files, temporary PDF review artifacts, and old logs.
$taskNames = @(
    '.next', '.tmp', 'tmp', 'out', '.swc',
    'tsconfig.tsbuildinfo', '.next-dev.stdout.log', '.next-dev.stderr.log'
)

function Get-DisposableBytes($taskItem) {
    if ($taskItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        # Next.js links dependencies here; never count or traverse their targets.
        return [long]0
    }
    if (-not $taskItem.PSIsContainer) { return [long]$taskItem.Length }
    [long]$taskBytes = 0
    foreach ($taskChild in Get-ChildItem -LiteralPath $taskItem.FullName -Force) {
        $taskBytes += Get-DisposableBytes $taskChild
    }
    return $taskBytes
}

function Remove-DisposableItem($taskItem) {
    if (-not $taskItem.FullName.StartsWith($taskPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path outside workspace: $($taskItem.FullName)"
    }
    if ($taskItem.PSIsContainer -and -not ($taskItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
        foreach ($taskChild in Get-ChildItem -LiteralPath $taskItem.FullName -Force) {
            Remove-DisposableItem $taskChild
        }
    }
    # Nonrecursive deletion removes a dependency link itself, never its target.
    $taskItem.Delete()
}

# Validate every resolved target and descendant before removing anything.
$taskTargets = foreach ($taskName in $taskNames) {
    $taskCandidate = [System.IO.Path]::GetFullPath((Join-Path $taskWorkspace $taskName))
    if (-not $taskCandidate.StartsWith($taskPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Target outside workspace: $taskCandidate"
    }
    if (-not (Test-Path -LiteralPath $taskCandidate)) { continue }
    $taskResolved = (Resolve-Path -LiteralPath $taskCandidate).ProviderPath
    if (-not $taskResolved.StartsWith($taskPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Resolved target outside workspace: $taskResolved"
    }
    $taskItem = Get-Item -LiteralPath $taskResolved -Force
    if ($taskItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        throw "Refusing to clean a linked root: $taskResolved"
    }
    [PSCustomObject]@{
        Name = $taskName
        Path = $taskResolved
        Bytes = Get-DisposableBytes $taskItem
    }
}

[long]$taskTotal = 0
foreach ($taskTarget in $taskTargets) {
    if (-not $DryRun) {
        Remove-DisposableItem (Get-Item -LiteralPath $taskTarget.Path -Force)
    }
    $taskTotal += $taskTarget.Bytes
    $taskLabel = if ($DryRun) { 'Would remove' } else { 'Removed' }
    Write-Output ('{0}: {1} ({2:N1} MB)' -f $taskLabel, $taskTarget.Name, ($taskTarget.Bytes / 1MB))
}
$taskLabel = if ($DryRun) { 'Reclaimable' } else { 'Reclaimed' }
Write-Output ('{0}: {1:N2} GB' -f $taskLabel, ($taskTotal / 1GB))
