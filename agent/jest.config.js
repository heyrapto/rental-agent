module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Test file patterns
    testMatch: [
        '**/test/**/*.test.js',
        '**/__tests__/**/*.js'
    ],
    
    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },
    
    // Coverage exclusions
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/**/*.test.js',
        '!src/**/*.spec.js',
        '!src/config/**',
        '!src/utils/logger.js'
    ],
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
    
    // Test timeout
    testTimeout: 30000,
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Restore mocks between tests
    restoreMocks: true,
    
    // Module name mapping
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    
    // Transform configuration
    transform: {},
    
    // Extensions
    moduleFileExtensions: ['js', 'json'],
    
    // Test path ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/build/'
    ],
    
    // Watch plugins
    watchPlugins: [
        'jest-watch-typeahead/filename',
        'jest-watch-typeahead/testname'
    ],
    
    // Global setup and teardown
    globalSetup: '<rootDir>/test/globalSetup.js',
    globalTeardown: '<rootDir>/test/globalTeardown.js',
    
    // Test results processor
    testResultsProcessor: 'jest-sonar-reporter',
    
    // Reporters
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: 'reports/junit',
                outputName: 'js-test-results.xml',
                classNameTemplate: '{classname}-{title}',
                titleTemplate: '{classname}-{title}',
                ancestorSeparator: ' › ',
                usePathForSuiteName: true
            }
        ]
    ],
    
    // Environment variables for tests
    setupFiles: ['<rootDir>/test/env.js'],
    
    // Mock files
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    
    // Coverage exclusions for specific files
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/test/',
        '/coverage/',
        '/dist/',
        '/build/',
        'jest.config.js',
        'package.json',
        'package-lock.json'
    ]
};