param(
    [string]$Drive = "",
    [int]$Limit = 200
)

[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = [Console]::OutputEncoding

$shell = New-Object -ComObject Shell.Application
$recycle = $shell.Namespace(10)

if ($null -eq $recycle) {
    @() | ConvertTo-Json -Depth 5
    exit 0
}

$items = @()
$index = 0

foreach ($item in $recycle.Items()) {
    $name = $recycle.GetDetailsOf($item, 0)
    $originalLocation = $recycle.GetDetailsOf($item, 1)
    $deletedDate = $recycle.GetDetailsOf($item, 2)
    $sizeDisplay = $recycle.GetDetailsOf($item, 3)
    $itemType = $recycle.GetDetailsOf($item, 4)
    $modifiedDate = $recycle.GetDetailsOf($item, 5)
    $rawPath = $item.Path

    if ([string]::IsNullOrWhiteSpace($originalLocation)) {
        continue
    }

    if (-not [string]::IsNullOrWhiteSpace($Drive)) {
        if (-not $originalLocation.StartsWith($Drive, [System.StringComparison]::OrdinalIgnoreCase)) {
            continue
        }
    }

    $items += [PSCustomObject]@{
        id = "recycle-$index"
        name = $name
        originalLocation = $originalLocation
        deletedDate = $deletedDate
        sizeDisplay = $sizeDisplay
        itemType = $itemType
        modifiedDate = $modifiedDate
        rawPath = $rawPath
    }

    $index += 1

    if ($items.Count -ge $Limit) {
        break
    }
}

$items | ConvertTo-Json -Depth 5
