param([string]$exe,[string]$dir,[string]$outdir,[string]$mode="aseprite")
# Opens every writer-produced *.rt.aseprite under $dir in a real editor and exports its frames.
$files = Get-ChildItem $dir -Recurse -Filter *.rt.aseprite
$log = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($dir.Length).TrimStart('\') -replace '\.rt\.aseprite$',''
  $d = Join-Path $outdir $rel
  New-Item -ItemType Directory -Force $d | Out-Null
  if ($mode -eq "aseprite") { $target = Join-Path $d "{frame}.png" } else { $target = Join-Path $d "0.png" }
  $p = Start-Process -FilePath $exe -ArgumentList @("-b", "`"$($f.FullName)`"", "--save-as", "`"$target`"") -NoNewWindow -PassThru -RedirectStandardOutput "$d\stdout.txt" -RedirectStandardError "$d\stderr.txt"
  if (-not $p.WaitForExit(60000)) { $p.Kill(); $log += "TIMEOUT $rel" } else { $log += "$($p.ExitCode) $rel" }
}
$log | Set-Content (Join-Path $outdir "export-log.txt")
"done $($files.Count)"
