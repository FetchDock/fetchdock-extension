import { useEffect, useState } from 'react';
import { sendMessage } from '@/lib/messaging';
import { NO_SERVER_FEATURES, type ServerFeatures } from '@/lib/wellKnown';

/** The server's optional features (via the background); none until known or when unreachable. */
export function useServerFeatures(): ServerFeatures {
    const [features, setFeatures] = useState<ServerFeatures>(NO_SERVER_FEATURES);
    useEffect(() => {
        let cancelled = false;
        sendMessage('getServerFeatures', undefined)
            .then((result) => { if (!cancelled) setFeatures(result); })
            .catch(() => undefined);
        return () => { cancelled = true; };
    }, []);
    return features;
}
