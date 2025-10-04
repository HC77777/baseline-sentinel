// TypeScript Test File for Baseline Sentinel

// Test 1: Array.at() - Should show warning
const numbers: number[] = [1, 2, 3, 4, 5];
const lastNumber = numbers.at(-1);
console.log('Last number:', lastNumber);

// Test 2: Object.hasOwn - Should show warning
const user = { name: 'Alice', age: 30 };
if (Object.hasOwn(user, 'name')) {
  console.log('Has name property');
}

// Test 3: Promise.allSettled - Should show warning
async function fetchData(): Promise<void> {
  const results = await Promise.allSettled([
    fetch('/api/data1'),
    fetch('/api/data2')
  ]);
  console.log(results);
}

// Test 4: event.keyCode (deprecated) - Should show warning with replacement fix
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.keyCode === 27) {
    console.log('Escape key pressed');
  }
});

// Test 5: navigator.clipboard - Should show warning
async function copyText(): Promise<void> {
  await navigator.clipboard.writeText('Hello World');
}

// Test 6: Array.toReversed() - Should show warning
const original: string[] = ['a', 'b', 'c'];
const reversed = original.toReversed();
console.log(reversed);

