-- Persist image bytes inside SQLite so free hosts don't lose photos when disk is wiped
ALTER TABLE photos ADD COLUMN file_blob BLOB;
ALTER TABLE enhancements ADD COLUMN file_blob BLOB;
