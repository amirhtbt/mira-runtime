<?php
declare(strict_types=1);
namespace Tinv\Sales;

final class JalaliDate
{
    public static function today(): array
    {
        $date=new \DateTimeImmutable('now',new \DateTimeZone('Asia/Tehran'));
        return ['date'=>$date->format('Y-m-d'),'jalali'=>self::format($date)];
    }
    public static function plusDays(string $date,int $days):array{$d=new \DateTimeImmutable($date,new \DateTimeZone('Asia/Tehran'));$d=$d->modify('+'.$days.' days');return ['date'=>$d->format('Y-m-d'),'jalali'=>self::format($d)];}
    public static function format(\DateTimeInterface $date):string
    {
        $gy=(int)$date->format('Y');$gm=(int)$date->format('n');$gd=(int)$date->format('j');
        $gdm=[0,31,59,90,120,151,181,212,243,273,304,334];$jy=$gy<=1600?0:979;$gy-= $gy<=1600?621:1600;
        $gy2=$gm>2?$gy+1:$gy;$days=365*$gy+intdiv($gy2+3,4)-intdiv($gy2+99,100)+intdiv($gy2+399,400)-80+$gd+$gdm[$gm-1];
        $jy+=33*intdiv($days,12053);$days%=12053;$jy+=4*intdiv($days,1461);$days%=1461;
        if($days>365){$jy+=intdiv($days-1,365);$days=($days-1)%365;}
        $jm=$days<186?1+intdiv($days,31):7+intdiv($days-186,30);$jd=1+($days<186?$days%31:($days-186)%30);
        return sprintf('%04d/%02d/%02d',$jy,$jm,$jd);
    }
}
