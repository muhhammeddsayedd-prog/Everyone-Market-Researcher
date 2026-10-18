import { describe, expect, it } from 'vitest';
import packet from './dev-batch-packet.json';
import { assertDevBatchPacket } from './batch-packet';

const counts = {
  competitors: 285,
  accounts: 1754,
  vimeoAccounts: 202,
  youtubeAccounts: 128,
  websiteAccounts: 460,
  remoteLogos: 267,
};
const approved = { ...packet, approved: true, approvalReference: 'owner reply: approved M02 dev batch' };
describe('bounded owner-approved M02 dev packet', () => {
  it('blocks the unapproved packet before any authentication or network request', () => {
    expect(() => assertDevBatchPacket(packet, packet.sourceSha256, packet.baselineSvgSha256, counts)).toThrow(
      'M02_DEV_BATCH_APPROVAL_PENDING',
    );
  });
  it('accepts only the approved target and reviewed source payload', () => {
    expect(
      assertDevBatchPacket(approved, packet.sourceSha256, packet.baselineSvgSha256, counts).limits
        .uploadedBytes,
    ).toBe(20 * 1024 * 1024);
  });
  it.each([
    [{ ...approved, target: 'hkiafqrcxaafdbcvjlzv' }, packet.sourceSha256, packet.baselineSvgSha256, counts],
    [approved, 'a'.repeat(64), packet.baselineSvgSha256, counts],
    [approved, packet.sourceSha256, 'a'.repeat(64), counts],
    [approved, packet.sourceSha256, packet.baselineSvgSha256, { ...counts, accounts: 1755 }],
    [{ ...approved, approvalReference: '' }, packet.sourceSha256, packet.baselineSvgSha256, counts],
  ])('rejects drift in source, volume or approval', (candidate, source, baseline, actual) => {
    expect(() =>
      assertDevBatchPacket(candidate, source as string, baseline as string, actual as typeof counts),
    ).toThrow(/^M02_/);
  });
});
