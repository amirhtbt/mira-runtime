<?php
declare(strict_types=1);

echo "migration_phase=bootstrap\n";
require dirname(__DIR__) . '/bootstrap.php';

use Tinv\Config;
use Tinv\Database;

echo "migration_phase=config\n";
$config = Config::fromEnvironment();

echo "migration_phase=db_connect\n";
$pdo = Database::connect($config);
$dir = dirname(__DIR__) . '/migrations';

echo "migration_phase=discover_files\n";
$files = glob($dir . '/*.sql') ?: [];

echo "migration_phase=sort_files\n";
sort($files, SORT_STRING);

echo "migration_phase=create_ledger\n";
$pdo->exec('CREATE TABLE IF NOT EXISTS migrations (version VARCHAR(128) PRIMARY KEY, applied_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

foreach ($files as $file) {
    echo "migration_phase=inspect_migration\n";
    $version = basename($file);
    $check = $pdo->prepare('SELECT 1 FROM migrations WHERE version = ?');
    $check->execute([$version]);
    if ($check->fetchColumn()) {
        echo "skip {$version}\n";
        continue;
    }

    echo "migration_phase=read_migration\n";
    $sql = file_get_contents($file);
    if ($sql === false) throw new RuntimeException("Cannot read {$file}");

    echo "migration_phase=begin_transaction\n";
    $pdo->beginTransaction();
    try {
        // MySQL DDL may implicitly commit. The migration remains idempotent via IF NOT EXISTS.
        echo "migration_phase=execute_migration\n";
        $pdo->exec($sql);
        echo "migration_phase=record_migration\n";
        $record = $pdo->prepare('INSERT INTO migrations (version, applied_at) VALUES (?, UTC_TIMESTAMP())');
        $record->execute([$version]);
        if ($pdo->inTransaction()) $pdo->commit();
        echo "applied {$version}\n";
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $exception;
    }
}

echo "migration_phase=complete\n";
