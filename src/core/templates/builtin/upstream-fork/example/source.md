# Upstream Fork Example

This example demonstrates how the upstream-fork template works.

## The Pattern

1. **upstream.md** - Represents the original upstream content
2. **Patches** - Defined in kustomark.yaml to customize the content
3. **Output** - The customized version with your branding and modifications

## Example Transformation

The upstream content mentions "UpstreamProduct" throughout. After applying patches:

- All instances of "UpstreamProduct" become "MyProduct"
- A custom footer is appended to track the source
- Frontmatter is updated with your metadata

## Running This Example

From the template directory:

```bash
# Preview the changes
kustomark diff

# Apply the patches
kustomark build

# Compare upstream vs customized
diff example/upstream.md output/upstream.md
```

## Expected Output

After running `kustomark build`, you should see:

1. All "UpstreamProduct" replaced with "MyProduct"
2. Custom footer added at the end
3. Frontmatter preserved from upstream
4. File structure maintained

## Customizing Further

Edit `kustomark.yaml` to add more patches:

```yaml
patches:
  # Remove a section you don't need
  - op: remove-section
    id: advanced-features

  # Add your own content
  - op: append-to-section
    id: getting-started
    content: |

      ### Quick Start Video

      Watch our 5-minute quick start video to get up and running fast.

  # Update frontmatter
  - op: set-frontmatter
    key: custom_field
    value: my_value
```

## Testing Your Patches

Create a test suite to verify your customizations:

```yaml
apiVersion: kustomark/v1
kind: PatchTestSuite

tests:
  - name: Branding replacement works
    input: |
      # UpstreamProduct Guide
      Welcome to UpstreamProduct.
    patches:
      - op: replace
        old: UpstreamProduct
        new: MyProduct
    expected: |
      # MyProduct Guide
      Welcome to MyProduct.
```

Run the tests:

```bash
kustomark test
```

## Next Steps

1. Point to a real upstream repository in `kustomark.yaml`
2. Add patches specific to your use case
3. Set up a watch to auto-rebuild on changes
4. Integrate into your CI/CD pipeline
