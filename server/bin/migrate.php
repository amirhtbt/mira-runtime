<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

use Tinv\Config;
use Tinv\Database;

$config = Config::fromEnvironment();
$pdo = Database::connect($config);
$dir = dirname(__DIR__) . '/migrations';
$files = glob($dir . '/*.sql') ?: [];
sort($files, SORT_STRING);

$pdo->exec('CREATE TABLE IF NOT EXISTS migrations (version VARCHAR(128) PRIMARY KEY, applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

foreach ($files as $file) {
    $version = basename($file);
    $check = $pdo->prepare('SELECT 1 FROM migrations WHERE version = ?');
    $check->execute([$version]);
    if ($check->fetchColumn()) {
        echo "skip {$version}\n";
        continue;
    }

    $sql = file_get_contents($file);
    if ($sql === false) throw new RuntimeException("Cannot read {$file}");

    $pdo->beginTransaction();
    try {
        // MySQL DDL may implicitly commit. The migration remains idempotent via IF NOT EXISTS.
        $pdo->exec($sql);
        $record = $pdo->prepare('INSERT INTO migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP())');
        $record->execute([$version]);
        if ($pdo->inTransaction()) $pdo->commit();
        echo "applied {$version}\n";
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}
