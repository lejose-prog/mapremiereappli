Add-Type -AssemblyName System.Web

$root = "C:\local\cours-claude"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8765/")
$listener.Start()
Write-Host "Serving $root on http://localhost:8765/"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".csv"  = "text/csv; charset=utf-8"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath

    if ($localPath -eq "/proxy") {
        # Récupère une page web côté serveur pour contourner le CORS du navigateur
        # (usage local uniquement : sert à la fonction "Résumer" de l'appli).
        $query = [System.Web.HttpUtility]::ParseQueryString($request.Url.Query)
        $targetUrl = $query["url"]

        if (-not $targetUrl -or $targetUrl -notmatch '^https?://') {
            $response.StatusCode = 400
            $response.ContentType = "text/plain; charset=utf-8"
            $msg = [System.Text.Encoding]::UTF8.GetBytes("Paramètre 'url' manquant ou invalide (http/https requis).")
            $response.OutputStream.Write($msg, 0, $msg.Length)
        } else {
            try {
                $webResponse = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 15 -Headers @{ "User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($webResponse.Content)
                $response.StatusCode = 200
                $response.ContentType = "text/html; charset=utf-8"
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } catch {
                $response.StatusCode = 502
                $response.ContentType = "text/plain; charset=utf-8"
                $errMsg = [System.Text.Encoding]::UTF8.GetBytes("Impossible de récupérer l'URL : " + $_.Exception.Message)
                $response.OutputStream.Write($errMsg, 0, $errMsg.Length)
            }
        }
        $response.OutputStream.Close()
        continue
    }

    if ($localPath -eq "/") { $localPath = "/index.html" }
    $filePath = Join-Path $root ($localPath.TrimStart("/"))

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath)
        $contentType = $mime[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $localPath")
        $response.OutputStream.Write($notFound, 0, $notFound.Length)
    }
    $response.OutputStream.Close()
}
