alter table api_key rename column secret to secret_hash;

update api_key set secret_hash = encode(sha256(secret_hash::bytea), 'hex');
