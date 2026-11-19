<?php
declare(strict_types=1);

namespace Tinv\Auth;

final readonly class IppanelPatternSms
{
    private const ENDPOINT = 'https://edge.ippanel.com/v1/api/send';

    public function __construct(
        private string $apiKey,
        private string $sender,
        private string $pattern,
        private string $variable,
    ) {
        if ($apiKey === '' || preg_match('/[\r\n]/', $apiKey)
            || !preg_match('/^\+[1-9][0-9]{5,14}$/D', $sender)
            || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $pattern)
            || !preg_match('/^[a-zA-Z0-9_]{1,32}$/D', $variable)) {
            throw new \InvalidArgumentException('mobile_sms_provider_config_invalid');
        }
    }

    public function deliver(string $phone, string $code): void
    {
        if (!function_exists('curl_init')) throw new \RuntimeException('mobile_sms_transport_unavailable');
        $handle = curl_init(self::ENDPOINT);
        if ($handle === false) throw new \RuntimeException('mobile_sms_transport_unavailable');
        try {
            curl_setopt_array($handle, [
                CURLOPT_POST => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_TIMEOUT => 8,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: ' . $this->apiKey],
                CURLOPT_POSTFIELDS => json_encode($this->payload($phone, $code), JSON_THROW_ON_ERROR),
            ]);
            $raw = curl_exec($handle);
            $status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            $response = is_string($raw) ? json_decode($raw, true, 16) : null;
            if ($status < 200 || $status >= 300 || ($response['meta']['status'] ?? null) !== true) {
                throw new \RuntimeException('mobile_sms_provider_rejected');
            }
        } finally {
            curl_close($handle);
        }
    }

    public function payload(string $phone, string $code): array
    {
        if (!preg_match('/^09[0-9]{9}$/D', $phone) || !preg_match('/^[0-9]{4}$/D', $code)) {
            throw new \InvalidArgumentException('mobile_sms_payload_invalid');
        }
        return [
            'sending_type' => 'pattern',
            'from_number' => $this->sender,
            'code' => $this->pattern,
            'recipients' => ['+98' . substr($phone, 1)],
            'params' => (object)[$this->variable => $code],
        ];
    }
}
