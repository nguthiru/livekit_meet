import Link from 'next/link';
import Image from 'next/image';

export function Brand() {
  return (
    <Link className="yoonka-brand" href="/" aria-label="Yoonka Meet home">
      <Image src="/brand/yoonka-mark.png" width={34} height={34} alt="" className="yoonka-mark" />
      <span className="yoonka-wordmark">YOONKA</span>
      <span className="yoonka-brand-divider" />
      <span className="yoonka-product">meet</span>
    </Link>
  );
}
