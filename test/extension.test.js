const { extractContent } = require('../utils');


describe('extractContent', () => {
  test('should extract function body and return object for data block', () => {
    const block = `
      data() {
        const a = 123123;
        return {
          message: 'Hello Vue!',
          currentDialog: null,
          c: [],
        };
      }
    `;
    const expected = {
      functionBody: `
        const a = 123123;
        `,
      returnObject: `
          message: 'Hello Vue!',
          currentDialog: null,
          c: [],
        `
    };
    const result = extractContent(block, 'data');
    expect(result).toEqual(expected);
  });

  test('should extract methods content', () => {
    const block = `
      methods: {
        greet() {
          console.log(this.message);
        }
      }
    `;
    const expected = `
        greet() {
          console.log(this.message);
        }
      `;
    const result = extractContent(block, 'methods');
    expect(result).toEqual(expected);
  });

  test('should extract export default content', () => {
    const block = `
      export default {
        data() {
          const test = "test";
          return {
            message: 'Hello Vue!'
          };
        },
        methods: {
          greet() {
            console.log(this.message);
          }
        }
      }
    `;
    const expected = `
        data() {
          const test = "test";
          return {
            message: 'Hello Vue!'
          };
        },
        methods: {
          greet() {
            console.log(this.message);
          }
        }
      `;
    const result = extractContent(block, 'export default');
    expect(result).toEqual(expected);
  });

  test('should return null for invalid block', () => {
    const block = `
      invalid block
    `;
    const result = extractContent(block, 'data');
    expect(result).toBeNull();
  });

  test('should return null if return statement is missing in data block', () => {
    const block = `
      data() {
        const a = 123123;
      }
    `;
    const result = extractContent(block, 'data');
    expect(result).toBeNull();
  });
});