import { createMediaUploadHandler, createMediaUploadReadinessHandler } from '../../../../server/media-upload';
import { createSupabaseMediaSigner } from '../../../../server/media-upload-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const HEAD = createMediaUploadReadinessHandler(() => process.env);
export const maxDuration = 15;

export const POST = createMediaUploadHandler({
  environment: () => process.env,
  signUpload: createSupabaseMediaSigner(),
});
