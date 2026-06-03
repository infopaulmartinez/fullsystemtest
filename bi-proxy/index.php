<?php
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

// Environment detection: use external IP in production, local IP in dev
$host = $_SERVER['HTTP_HOST'] ?? '';
$isProduction = strpos($host, 'admin.szemesipekseg.com') !== false || strpos($host, '82.163.176.124') !== false;
$target = $isProduction ? 'http://45.130.240.216:82' : 'http://192.168.2.80:82';

function allowCors() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    allowCors();
    http_response_code(204);
    exit;
}

// Az /bi-proxy/ után jövő rész
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!empty($_GET['path'])) {
    $path = '/' . ltrim($_GET['path'], '/');
} elseif (!empty($_SERVER['PATH_INFO'])) {
    $path = $_SERVER['PATH_INFO'];
} else {
    $path = preg_replace('#^/bi-proxy#', '', $requestPath);
    $path = preg_replace('#^/index\.php#', '', $path);
}
if ($path === '' || $path === null) {
    $path = '/';
}
$url = $target . $path;

$body = file_get_contents('php://input');
$method = $_SERVER['REQUEST_METHOD'];

$headers = [];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $k => $v) {
        if (strtolower($k) === 'host') continue;
        $headers[] = "$k: $v";
    }
}

// Use cURL if available (more reliable on shared hosting)
if (extension_loaded('curl')) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
    ]);
    
    if ($body) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    
    $response = curl_exec($ch);
    
    if ($response === false) {
        allowCors();
        http_response_code(502);
        echo "Proxy error: cURL failed - " . curl_error($ch);
        curl_close($ch);
        exit;
    }
    
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $headerText = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    http_response_code($statusCode);
    
    foreach (explode("\r\n", $headerText) as $line) {
        if (empty($line)) continue;
        $ll = strtolower($line);
        if (strpos($ll, 'x-frame-options') === 0) continue;
        if (strpos($ll, 'content-security-policy') === 0) continue;
        if (strpos($ll, 'transfer-encoding') === 0) continue;
        if (strpos($ll, 'http/') === 0) continue;
        header($line);
    }
} else {
    // Fallback to file_get_contents
    $ctx = stream_context_create([
        'http' => [
            'method'  => $method,
            'header'  => implode("\r\n", $headers),
            'content' => $body,
            'ignore_errors' => true,
            'timeout' => 15,
        ]
    ]);
    
    $response = @file_get_contents($url, false, $ctx);
    
    if ($response === false) {
        allowCors();
        http_response_code(502);
        echo 'Proxy error: unable to reach Blue Iris server';
        exit;
    }
    
    if (!empty($http_response_header)) {
        $statusHeader = $http_response_header[0] ?? '';
        if (preg_match('#^HTTP/\d+\.\d+\s+(\d+)#', $statusHeader, $matches)) {
            http_response_code((int)$matches[1]);
        }
        foreach ($http_response_header as $h) {
            if (stripos($h, 'X-Frame-Options') !== false) continue;
            if (stripos($h, 'Content-Security-Policy') !== false) continue;
            if (stripos($h, 'Transfer-Encoding') !== false) continue;
            header($h);
        }
    }
}

allowCors();
echo $body;