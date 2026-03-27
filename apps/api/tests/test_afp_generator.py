"""Tests for AFP Structured Field Identifiers per MO:DCA specification."""

from app.afp_document_generator import SF_BDT, SF_EDT, SF_BPG, SF_EPG


class TestStructuredFieldIdentifiers:
    """Verify SF IDs match the MO:DCA Architecture Reference."""

    def test_bdt_uses_correct_sf_id(self):
        """BDT (Begin Document) must be D3 A8 A8."""
        assert SF_BDT == bytes([0xD3, 0xA8, 0xA8]), (
            f"BDT should be D3 A8 A8, got {SF_BDT.hex(' ').upper()}"
        )

    def test_edt_uses_correct_sf_id(self):
        """EDT (End Document) must be D3 A9 A8."""
        assert SF_EDT == bytes([0xD3, 0xA9, 0xA8]), (
            f"EDT should be D3 A9 A8, got {SF_EDT.hex(' ').upper()}"
        )

    def test_bpg_uses_correct_sf_id(self):
        """BPG (Begin Page) must be D3 A8 AF."""
        assert SF_BPG == bytes([0xD3, 0xA8, 0xAF]), (
            f"BPG should be D3 A8 AF, got {SF_BPG.hex(' ').upper()}"
        )

    def test_epg_uses_correct_sf_id(self):
        """EPG (End Page) must be D3 A9 AF."""
        assert SF_EPG == bytes([0xD3, 0xA9, 0xAF]), (
            f"EPG should be D3 A9 AF, got {SF_EPG.hex(' ').upper()}"
        )
