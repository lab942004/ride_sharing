const healthUrl = process.env.HEALTH_URL;

if (!healthUrl) {
  console.error('HEALTH_URL is required');
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);

fetch(healthUrl, { signal: controller.signal })
  .then(async (response) => {
    const body = await response.text();
    console.log(`[Health ping] ${response.status} ${healthUrl} ${body}`);
    if (!response.ok) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(`[Health ping] failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => clearTimeout(timeout));