<?php
declare(strict_types=1);

namespace Tinv\Export;

use PDO;
use RuntimeException;

final readonly class TemporaryExportFileService
{
    public const MAX_BYTES = 8_388_608;
    // Download payloads expire after 30 minutes; prepared-share payloads may
    // extend to one hour. The hourly sweeper then keeps physical retention
    // within the owner's two-hour ceiling while document data stays durable.
    public const DOWNLOAD_TTL_SECONDS = 1_800;
    public const SHARE_TTL_CAP_SECONDS = 3_600;

    public function __construct(private PDO $pdo) {}

    /** @return array{token:string,mimeType:string,fileName:string,byteSize:int,expiresAt:int} */
    public function store(string $businessId, string $documentId, string $bytes, string $claimedMimeType, string $fileName, int $ttlSeconds = self::DOWNLOAD_TTL_SECONDS): array
    {
        $byteSize = strlen($bytes);
        if ($byteSize < 1 || $byteSize > self::MAX_BYTES) {
            throw new RuntimeException('temporary_export_size_invalid');
        }
        if ($ttlSeconds < 60 || $ttlSeconds > self::SHARE_TTL_CAP_SECONDS) {
            throw new RuntimeException('temporary_export_ttl_invalid');
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detectedMimeType = (string) $finfo->buffer($bytes);
        $allowed = ['application/pdf' => 'pdf'];
        if (!isset($allowed[$detectedMimeType]) || $claimedMimeType !== $detectedMimeType) {
            throw new RuntimeException('temporary_export_type_invalid');
        }

        $safeName = preg_replace('/[\x00-\x1F\x7F\\\/]+/u', '-', trim($fileName)) ?: '';
        $safeName = mb_substr($safeName, 0, 160, 'UTF-8');
        $extension = $allowed[$detectedMimeType];
        if ($safeName === '' || !str_ends_with(strtolower($safeName), '.' . $extension)) {
            $safeName = 'bahar-export.pdf';
        }

        $this->cleanupExpired();
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token, true);
        $now = time();
        $expiresAt = $now + $ttlSeconds;
        $statement = $this->pdo->prepare(
            'INSERT INTO temporary_export_files (token_hash,business_id,document_id,mime_type,file_name,byte_size,file_bytes,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?)'
        );
        $statement->bindValue(1, $tokenHash, PDO::PARAM_LOB);
        $statement->bindValue(2, $businessId);
        $statement->bindValue(3, $documentId);
        $statement->bindValue(4, $detectedMimeType);
        $statement->bindValue(5, $safeName);
        $statement->bindValue(6, $byteSize, PDO::PARAM_INT);
        $statement->bindValue(7, $bytes, PDO::PARAM_LOB);
        $statement->bindValue(8, gmdate('Y-m-d H:i:s', $now));
        $statement->bindValue(9, gmdate('Y-m-d H:i:s', $expiresAt));
        $statement->execute();

        return ['token' => $token, 'mimeType' => $detectedMimeType, 'fileName' => $safeName, 'byteSize' => $byteSize, 'expiresAt' => $expiresAt];
    }

    /** @return array{mimeType:string,fileName:string,byteSize:int,bytes:string,expiresAt:int}|null */
    public function fetch(string $token): ?array
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) {
            return null;
        }
        $this->cleanupExpired();
        $statement = $this->pdo->prepare('SELECT mime_type,file_name,byte_size,file_bytes,expires_at FROM temporary_export_files WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() LIMIT 1');
        $statement->bindValue(1, hash('sha256', $token, true), PDO::PARAM_LOB);
        $statement->execute();
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }
        $bytes = $row['file_bytes'];
        if (is_resource($bytes)) {
            $bytes = stream_get_contents($bytes);
        }
        if (!is_string($bytes) || strlen($bytes) !== (int) $row['byte_size']) {
            return null;
        }
        $expiresAt = strtotime((string) $row['expires_at'] . ' UTC');
        return [
            'mimeType' => (string) $row['mime_type'],
            'fileName' => (string) $row['file_name'],
            'byteSize' => (int) $row['byte_size'],
            'bytes' => $bytes,
            'expiresAt' => $expiresAt === false ? time() : $expiresAt,
        ];
    }

    public function extendExpiry(string $token, int $requestedEpoch): int
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) {
            throw new RuntimeException('temporary_export_token_invalid');
        }
        $now = time();
        $expiresAt = max($now + 60, min($requestedEpoch, $now + self::SHARE_TTL_CAP_SECONDS));
        $statement = $this->pdo->prepare('UPDATE temporary_export_files SET expires_at=? WHERE token_hash=?');
        $statement->bindValue(1, gmdate('Y-m-d H:i:s', $expiresAt));
        $statement->bindValue(2, hash('sha256', $token, true), PDO::PARAM_LOB);
        $statement->execute();
        if ($statement->rowCount() !== 1) {
            throw new RuntimeException('temporary_export_not_found');
        }
        return $expiresAt;
    }

    public function delete(string $token): void
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) {
            return;
        }
        $statement = $this->pdo->prepare('DELETE FROM temporary_export_files WHERE token_hash=?');
        $statement->bindValue(1, hash('sha256', $token, true), PDO::PARAM_LOB);
        $statement->execute();
    }

    public function cleanupExpired(): int
    {
        return $this->pdo->exec('DELETE FROM temporary_export_files WHERE expires_at<=UTC_TIMESTAMP()');
    }
}
