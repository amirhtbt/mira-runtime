<?php
declare(strict_types=1);

namespace Tinv\Telegram;

use RuntimeException;

final readonly class PreparedMessageService
{
    public function __construct(private string $botToken) {}

    /** @return array{id:string,expirationDate:int} */
    public function preparePdf(string $telegramUserId, string $documentUrl, string $title): array
    {
        if (!preg_match('/^[1-9][0-9]{0,19}$/D', $telegramUserId)) {
            throw new RuntimeException('telegram_user_id_invalid');
        }
        if (!filter_var($documentUrl, FILTER_VALIDATE_URL) || !str_starts_with($documentUrl, 'https://')) {
            throw new RuntimeException('prepared_document_url_invalid');
        }
        $safeTitle = trim($title);
        if ($safeTitle === '') {
            $safeTitle = 'سند فاکتورساز بهار';
        }
        $safeTitle = mb_substr($safeTitle, 0, 100, 'UTF-8');

        $payload = [
            'user_id' => $telegramUserId,
            'result' => [
                'type' => 'document',
                'id' => substr(hash('sha256', $documentUrl), 0, 32),
                'title' => $safeTitle,
                'document_url' => $documentUrl,
                'mime_type' => 'application/pdf',
                'caption' => 'سند ساخته شده با فاکتورساز بهار',
            ],
            'allow_user_chats' => true,
            'allow_bot_chats' => true,
            'allow_group_chats' => true,
            'allow_channel_chats' => true,
        ];
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (!function_exists('curl_init')) {
            throw new RuntimeException('telegram_transport_unavailable');
        }

        $handle = curl_init('https://api.telegram.org/bot' . $this->botToken . '/savePreparedInlineMessage');
        if ($handle === false) {
            throw new RuntimeException('telegram_transport_unavailable');
        }
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 12,
        ]);
        $response = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        if (!is_string($response) || $status < 200 || $status >= 300) {
            throw new RuntimeException('telegram_prepare_failed');
        }
        $decoded = json_decode($response, true, 16, JSON_THROW_ON_ERROR);
        $id = $decoded['result']['id'] ?? null;
        $expirationDate = $decoded['result']['expiration_date'] ?? null;
        if (($decoded['ok'] ?? false) !== true || !is_string($id) || $id === '' || !is_int($expirationDate)) {
            throw new RuntimeException('telegram_prepare_failed');
        }
        return ['id' => $id, 'expirationDate' => $expirationDate];
    }
}
