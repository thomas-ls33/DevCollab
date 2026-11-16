#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

REGION=${AWS_REGION:-us-east-1}
API_ID=${API_ID:-gn25if1p83}
STAGE=${STAGE:-prod}
USER_POOL_ID=${COGNITO_USER_POOL_ID:-us-east-1_KCLNd779Y}
DB_NAME_VALUE=${DB_NAME_VALUE:-devcollab}
PYTHON=${PYTHON:-python3}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Compte $ACCOUNT_ID, région $REGION, API $API_ID, stage $STAGE"
./scripts/build.sh

for fn in utilisateurs projets pull-requests reviews activite; do
  name="devcollab-$fn"
  echo "Déploiement de $name"
  aws lambda update-function-code --function-name "$name" --zip-file "fileb://dist/$name.zip" --region "$REGION" >/dev/null
  aws lambda wait function-updated --function-name "$name" --region "$REGION"

  vars=$(aws lambda get-function-configuration --function-name "$name" --region "$REGION" --query 'Environment.Variables' --output json)
  env_json=$(echo "$vars" | "$PYTHON" -c "import json,sys; v=json.load(sys.stdin) or {}; v['DB_NAME']='$DB_NAME_VALUE'; v.setdefault('DB_SSL','require'); print(json.dumps({'Variables': v}))")
  aws lambda update-function-configuration --function-name "$name" --region "$REGION" \
    --handler lambda_function.lambda_handler --timeout 15 --memory-size 256 \
    --environment "$env_json" >/dev/null
  aws lambda wait function-updated --function-name "$name" --region "$REGION"

  aws lambda add-permission --function-name "$name" --region "$REGION" \
    --statement-id apigateway-devcollab --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*" >/dev/null 2>&1 || true
done

sed -e "s/\${AWS_REGION}/$REGION/g" -e "s/\${AWS_ACCOUNT_ID}/$ACCOUNT_ID/g" -e "s/\${COGNITO_USER_POOL_ID}/$USER_POOL_ID/g" \
  openapi.yaml > dist/openapi.aws.yaml

echo "Import de la spécification OpenAPI dans API Gateway"
aws apigateway put-rest-api --rest-api-id "$API_ID" --mode overwrite --body "fileb://dist/openapi.aws.yaml" --region "$REGION" >/dev/null
aws apigateway create-deployment --rest-api-id "$API_ID" --stage-name "$STAGE" --region "$REGION" >/dev/null

echo "API déployée : https://$API_ID.execute-api.$REGION.amazonaws.com/$STAGE"
