# RDS dev notes

## Connect with psql (Mac)

Install the client if needed:
```
brew install libpq
brew link --force libpq
```

Connect (replace host with the endpoint printed by the script):
```
psql "postgresql://$DB_USER:$DB_PASSWORD@<endpoint>:5432/adhocprint"
```

## Set DATABASE_URL

For API or worker `.env.local`:
```
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@<endpoint>:5432/adhocprint
```

## Security note

This dev instance is public for convenience. Production should use private subnets, security groups with least privilege, and no public access.
