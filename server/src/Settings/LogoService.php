<?php
declare(strict_types=1);

namespace Tinv\Settings;

use PDO;

final readonly class LogoService
{
    public const MAX_BYTES = 1572864;
    public const MAX_DIMENSION = 2048;
    private const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];

    public function __construct(private PDO $pdo) {}

    /** @return array{mimeType:string,byteSize:int,width:int,height:int} */
    public static function validateBytes(string $bytes): array
    {
        $size = strlen($bytes);
        if ($size < 16) throw new LogoValidationException('invalid_image');
        if ($size > self::MAX_BYTES) throw new LogoValidationException('too_large');

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->buffer($bytes);
        if (!in_array($mime, self::ALLOWED_MIME, true)) throw new LogoValidationException('unsupported_type');

        $image = @getimagesizefromstring($bytes);
        if ($image === false || !isset($image[0], $image[1], $image['mime'])) throw new LogoValidationException('invalid_image');
        $width = (int) $image[0];
        $height = (int) $image[1];
        $imageMime = (string) $image['mime'];
        if ($imageMime !== $mime || !in_array($imageMime, self::ALLOWED_MIME, true)) throw new LogoValidationException('mime_mismatch');
        if ($width < 1 || $height < 1 || $width > self::MAX_DIMENSION || $height > self::MAX_DIMENSION) {
            throw new LogoValidationException('dimensions_rejected');
        }

        return ['mimeType' => $mime, 'byteSize' => $size, 'width' => $width, 'height' => $height];
    }

    /** @return array{mimeType:string,byteSize:int,width:int,height:int,updatedAt:string} */
    public function save(string $businessId, string $bytes, ?int $now = null): array
    {
        $meta = self::validateBytes($bytes);
        $timestamp = gmdate('Y-m-d H:i:s', $now ?? time());
        $stmt = $this->pdo->prepare(
            'INSERT INTO business_logo_assets (business_id, mime_type, byte_size, width, height, image_bytes, updated_at) '
            . 'VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE mime_type = VALUES(mime_type), byte_size = VALUES(byte_size), '
            . 'width = VALUES(width), height = VALUES(height), image_bytes = VALUES(image_bytes), updated_at = VALUES(updated_at)'
        );
        $stmt->bindValue(1, $businessId);
        $stmt->bindValue(2, $meta['mimeType']);
        $stmt->bindValue(3, $meta['byteSize'], PDO::PARAM_INT);
        $stmt->bindValue(4, $meta['width'], PDO::PARAM_INT);
        $stmt->bindValue(5, $meta['height'], PDO::PARAM_INT);
        $stmt->bindValue(6, $bytes, PDO::PARAM_LOB);
        $stmt->bindValue(7, $timestamp);
        $stmt->execute();

        return $meta + ['updatedAt' => $timestamp];
    }

    /** @return array{mimeType:string,byteSize:int,width:int,height:int,bytes:string,updatedAt:string}|null */
    public function get(string $businessId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT mime_type, byte_size, width, height, image_bytes, updated_at FROM business_logo_assets WHERE business_id = ? LIMIT 1');
        $stmt->execute([$businessId]);
        $row = $stmt->fetch();
        if (!$row) return null;
        return [
            'mimeType' => (string) $row['mime_type'],
            'byteSize' => (int) $row['byte_size'],
            'width' => (int) $row['width'],
            'height' => (int) $row['height'],
            'bytes' => (string) $row['image_bytes'],
            'updatedAt' => (string) $row['updated_at'],
        ];
    }

    /** @return array{present:bool,mimeType:?string,byteSize:?int,width:?int,height:?int,updatedAt:?string} */
    public function metadata(string $businessId): array
    {
        $asset = $this->get($businessId);
        if ($asset === null) return ['present' => false, 'mimeType' => null, 'byteSize' => null, 'width' => null, 'height' => null, 'updatedAt' => null];
        return [
            'present' => true,
            'mimeType' => $asset['mimeType'],
            'byteSize' => $asset['byteSize'],
            'width' => $asset['width'],
            'height' => $asset['height'],
            'updatedAt' => $asset['updatedAt'],
        ];
    }

    public function delete(string $businessId): void
    {
        $stmt = $this->pdo->prepare('DELETE FROM business_logo_assets WHERE business_id = ?');
        $stmt->execute([$businessId]);
    }
}
